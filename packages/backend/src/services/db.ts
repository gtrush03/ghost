import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import type { Member, MemberWithPower, DepositRecord, SettingsChangeRecord, PoolStats } from "@ghost/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../../../../data/ghost-dao.db");

let db: Database.Database;

export function initDatabase(): Database.Database {
  mkdirSync(resolve(__dirname, "../../../../data"), { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      display_name TEXT,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id),
      token_address TEXT NOT NULL,
      amount_raw TEXT NOT NULL,
      amount_human REAL NOT NULL DEFAULT 0,
      amount_usd REAL NOT NULL DEFAULT 0,
      relay_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id),
      token_address TEXT NOT NULL,
      amount_raw TEXT NOT NULL,
      amount_human REAL NOT NULL DEFAULT 0,
      amount_usd REAL NOT NULL DEFAULT 0,
      relay_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requested_by INTEGER NOT NULL REFERENCES members(id),
      setting_key TEXT NOT NULL,
      old_value TEXT NOT NULL,
      new_value TEXT NOT NULL,
      voting_power REAL NOT NULL,
      required_power REAL NOT NULL DEFAULT 0.51,
      approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_token TEXT NOT NULL,
      from_symbol TEXT NOT NULL,
      to_token TEXT NOT NULL,
      to_symbol TEXT NOT NULL,
      amount_in TEXT NOT NULL,
      amount_in_human REAL NOT NULL DEFAULT 0,
      amount_usd REAL NOT NULL DEFAULT 0,
      tx_hash TEXT,
      relay_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      initiated_by TEXT NOT NULL DEFAULT 'user',
      strategy_rule_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      ref_id INTEGER,
      actor_wallet TEXT,
      summary TEXT NOT NULL,
      details TEXT,
      privacy TEXT NOT NULL DEFAULT 'private',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS strategy_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_type TEXT NOT NULL,
      token_symbol TEXT,
      target_pct REAL,
      trigger_price REAL,
      trigger_direction TEXT,
      trigger_action TEXT,
      trigger_amount_pct REAL,
      threshold_pct REAL,
      created_by INTEGER REFERENCES members(id),
      voting_power_used REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deactivated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS autonomous_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_rule_id INTEGER NOT NULL REFERENCES strategy_rules(id),
      trade_id INTEGER REFERENCES trades(id),
      from_symbol TEXT NOT NULL,
      to_symbol TEXT NOT NULL,
      amount_human REAL NOT NULL DEFAULT 0,
      amount_usd REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

// --- Members ---

export function ensureMember(walletAddress: string, displayName?: string): Member {
  const normalized = walletAddress.toLowerCase();

  const existing = db.prepare("SELECT * FROM members WHERE wallet_address = ?").get(normalized) as any;
  if (existing) {
    return {
      id: existing.id,
      walletAddress: existing.wallet_address,
      displayName: existing.display_name,
      joinedAt: existing.joined_at,
      isActive: !!existing.is_active,
    };
  }

  const result = db.prepare(
    "INSERT INTO members (wallet_address, display_name) VALUES (?, ?)"
  ).run(normalized, displayName ?? null);

  return {
    id: result.lastInsertRowid as number,
    walletAddress: normalized,
    displayName: displayName ?? null,
    joinedAt: new Date().toISOString(),
    isActive: true,
  };
}

export function getMember(walletAddress: string): Member | null {
  const row = db.prepare("SELECT * FROM members WHERE wallet_address = ?").get(walletAddress.toLowerCase()) as any;
  if (!row) return null;
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    displayName: row.display_name,
    joinedAt: row.joined_at,
    isActive: !!row.is_active,
  };
}

export function getAllMembers(): Member[] {
  const rows = db.prepare("SELECT * FROM members WHERE is_active = 1 ORDER BY joined_at ASC").all() as any[];
  return rows.map((row) => ({
    id: row.id,
    walletAddress: row.wallet_address,
    displayName: row.display_name,
    joinedAt: row.joined_at,
    isActive: !!row.is_active,
  }));
}

// --- Deposits ---

export function createDeposit(params: {
  memberId: number;
  tokenAddress: string;
  amountRaw: string;
  amountHuman: number;
  amountUsd: number;
  relayId?: string;
}): number {
  const result = db.prepare(`
    INSERT INTO deposits (member_id, token_address, amount_raw, amount_human, amount_usd, relay_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(params.memberId, params.tokenAddress, params.amountRaw, params.amountHuman, params.amountUsd, params.relayId ?? null);
  return result.lastInsertRowid as number;
}

export function confirmDeposit(relayId: string): void {
  db.prepare(`
    UPDATE deposits SET status = 'confirmed', confirmed_at = datetime('now') WHERE relay_id = ?
  `).run(relayId);
}

// --- Withdrawals ---

export function createWithdrawal(params: {
  memberId: number;
  tokenAddress: string;
  amountRaw: string;
  amountHuman: number;
  amountUsd: number;
  relayId?: string;
}): number {
  const result = db.prepare(`
    INSERT INTO withdrawals (member_id, token_address, amount_raw, amount_human, amount_usd, relay_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(params.memberId, params.tokenAddress, params.amountRaw, params.amountHuman, params.amountUsd, params.relayId ?? null);
  return result.lastInsertRowid as number;
}

// --- Voting Power ---

function getMemberNetUsd(memberId: number): number {
  const deposits = db.prepare(
    "SELECT COALESCE(SUM(amount_usd), 0) as total FROM deposits WHERE member_id = ? AND status = 'confirmed'"
  ).get(memberId) as any;
  const withdrawals = db.prepare(
    "SELECT COALESCE(SUM(amount_usd), 0) as total FROM withdrawals WHERE member_id = ? AND status = 'confirmed'"
  ).get(memberId) as any;
  return (deposits?.total ?? 0) - (withdrawals?.total ?? 0);
}

function getPoolTotalUsd(): number {
  const deposits = db.prepare(
    "SELECT COALESCE(SUM(amount_usd), 0) as total FROM deposits WHERE status = 'confirmed'"
  ).get() as any;
  const withdrawals = db.prepare(
    "SELECT COALESCE(SUM(amount_usd), 0) as total FROM withdrawals WHERE status = 'confirmed'"
  ).get() as any;
  return (deposits?.total ?? 0) - (withdrawals?.total ?? 0);
}

export function getVotingPower(walletAddress: string): number {
  const member = getMember(walletAddress);
  if (!member) return 0;
  const memberNet = getMemberNetUsd(member.id);
  const poolTotal = getPoolTotalUsd();
  if (poolTotal <= 0) return 0;
  return memberNet / poolTotal;
}

export function getMembersWithPower(): MemberWithPower[] {
  const members = getAllMembers();
  const poolTotal = getPoolTotalUsd();

  return members.map((m) => {
    const deposits = db.prepare(
      "SELECT COALESCE(SUM(amount_usd), 0) as total FROM deposits WHERE member_id = ? AND status = 'confirmed'"
    ).get(m.id) as any;
    const withdrawals = db.prepare(
      "SELECT COALESCE(SUM(amount_usd), 0) as total FROM withdrawals WHERE member_id = ? AND status = 'confirmed'"
    ).get(m.id) as any;

    const totalDeposited = deposits?.total ?? 0;
    const totalWithdrawn = withdrawals?.total ?? 0;
    const net = totalDeposited - totalWithdrawn;
    const power = poolTotal > 0 ? net / poolTotal : 0;

    return {
      ...m,
      totalDepositedUsd: totalDeposited,
      totalWithdrawnUsd: totalWithdrawn,
      netValueUsd: net,
      votingPower: Math.max(0, Math.min(1, power)),
      sharePercent: Math.max(0, Math.min(100, power * 100)),
    };
  });
}

// --- Pool Stats ---

export function getPoolStats(): PoolStats {
  const members = db.prepare("SELECT COUNT(*) as total FROM members").get() as any;
  const active = db.prepare("SELECT COUNT(*) as total FROM members WHERE is_active = 1").get() as any;
  const deposits = db.prepare("SELECT COALESCE(SUM(amount_usd), 0) as total FROM deposits WHERE status = 'confirmed'").get() as any;
  const withdrawals = db.prepare("SELECT COALESCE(SUM(amount_usd), 0) as total FROM withdrawals WHERE status = 'confirmed'").get() as any;

  const totalDep = deposits?.total ?? 0;
  const totalWith = withdrawals?.total ?? 0;

  return {
    totalMembers: members?.total ?? 0,
    activeMembers: active?.total ?? 0,
    totalDepositedUsd: totalDep,
    totalWithdrawnUsd: totalWith,
    netPoolUsd: totalDep - totalWith,
  };
}

// --- Settings Changes (Audit Log) ---

export function recordSettingsChange(params: {
  requestedBy: number;
  settingKey: string;
  oldValue: string;
  newValue: string;
  votingPower: number;
  requiredPower?: number;
  approved: boolean;
}): number {
  const result = db.prepare(`
    INSERT INTO settings_changes (requested_by, setting_key, old_value, new_value, voting_power, required_power, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.requestedBy,
    params.settingKey,
    params.oldValue,
    params.newValue,
    params.votingPower,
    params.requiredPower ?? 0.51,
    params.approved ? 1 : 0
  );
  return result.lastInsertRowid as number;
}

export function getRecentSettingsChanges(limit = 10): SettingsChangeRecord[] {
  const rows = db.prepare(`
    SELECT * FROM settings_changes ORDER BY created_at DESC LIMIT ?
  `).all(limit) as any[];
  return rows.map((row) => ({
    id: row.id,
    requestedBy: row.requested_by,
    settingKey: row.setting_key,
    oldValue: row.old_value,
    newValue: row.new_value,
    votingPower: row.voting_power,
    requiredPower: row.required_power,
    approved: !!row.approved,
    createdAt: row.created_at,
  }));
}

export function getDepositsForMember(memberId: number): DepositRecord[] {
  const rows = db.prepare("SELECT * FROM deposits WHERE member_id = ? ORDER BY created_at DESC").all(memberId) as any[];
  return rows.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    tokenAddress: row.token_address,
    amountRaw: row.amount_raw,
    amountHuman: row.amount_human,
    amountUsd: row.amount_usd,
    relayId: row.relay_id,
    status: row.status,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  }));
}

// --- Trades ---

export function createTrade(params: {
  fromToken: string;
  fromSymbol: string;
  toToken: string;
  toSymbol: string;
  amountIn: string;
  amountInHuman: number;
  amountUsd: number;
  txHash?: string;
  relayId?: string;
  status?: string;
  initiatedBy?: string;
  strategyRuleId?: number;
}): number {
  const result = db.prepare(`
    INSERT INTO trades (from_token, from_symbol, to_token, to_symbol, amount_in, amount_in_human, amount_usd, tx_hash, relay_id, status, initiated_by, strategy_rule_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.fromToken, params.fromSymbol, params.toToken, params.toSymbol,
    params.amountIn, params.amountInHuman, params.amountUsd,
    params.txHash ?? null, params.relayId ?? null, params.status ?? "pending",
    params.initiatedBy ?? "user", params.strategyRuleId ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateTradeStatus(tradeId: number, status: string, txHash?: string): void {
  if (txHash) {
    db.prepare("UPDATE trades SET status = ?, tx_hash = ? WHERE id = ?").run(status, txHash, tradeId);
  } else {
    db.prepare("UPDATE trades SET status = ? WHERE id = ?").run(status, tradeId);
  }
}

// --- Activity Log ---

export function logActivity(params: {
  eventType: string;
  refId?: number;
  actorWallet?: string;
  summary: string;
  details?: Record<string, unknown>;
  privacy?: string;
}): number {
  const result = db.prepare(`
    INSERT INTO activity_log (event_type, ref_id, actor_wallet, summary, details, privacy)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    params.eventType,
    params.refId ?? null,
    params.actorWallet ?? null,
    params.summary,
    params.details ? JSON.stringify(params.details) : null,
    params.privacy ?? "private"
  );
  return result.lastInsertRowid as number;
}

export function getActivityLog(params?: {
  limit?: number;
  offset?: number;
  eventType?: string;
}): Array<{
  id: number;
  eventType: string;
  refId: number | null;
  actorWallet: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  privacy: string;
  createdAt: string;
}> {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;

  let query = "SELECT * FROM activity_log";
  const queryParams: unknown[] = [];

  if (params?.eventType) {
    query += " WHERE event_type = ?";
    queryParams.push(params.eventType);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  queryParams.push(limit, offset);

  const rows = db.prepare(query).all(...queryParams) as any[];
  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    refId: row.ref_id,
    actorWallet: row.actor_wallet,
    summary: row.summary,
    details: row.details ? JSON.parse(row.details) : null,
    privacy: row.privacy,
    createdAt: row.created_at,
  }));
}

// --- Strategy Rules ---

export function createStrategyRule(params: {
  ruleType: string;
  tokenSymbol?: string;
  targetPct?: number;
  triggerPrice?: number;
  triggerDirection?: string;
  triggerAction?: string;
  triggerAmountPct?: number;
  thresholdPct?: number;
  createdBy: number;
  votingPowerUsed: number;
}): number {
  const result = db.prepare(`
    INSERT INTO strategy_rules (rule_type, token_symbol, target_pct, trigger_price, trigger_direction, trigger_action, trigger_amount_pct, threshold_pct, created_by, voting_power_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.ruleType,
    params.tokenSymbol ?? null,
    params.targetPct ?? null,
    params.triggerPrice ?? null,
    params.triggerDirection ?? null,
    params.triggerAction ?? null,
    params.triggerAmountPct ?? null,
    params.thresholdPct ?? null,
    params.createdBy,
    params.votingPowerUsed
  );
  return result.lastInsertRowid as number;
}

export function getActiveStrategyRules(): Array<{
  id: number;
  ruleType: string;
  tokenSymbol: string | null;
  targetPct: number | null;
  triggerPrice: number | null;
  triggerDirection: string | null;
  triggerAction: string | null;
  triggerAmountPct: number | null;
  thresholdPct: number | null;
  createdBy: number;
  votingPowerUsed: number;
  createdAt: string;
}> {
  const rows = db.prepare("SELECT * FROM strategy_rules WHERE is_active = 1 ORDER BY created_at ASC").all() as any[];
  return rows.map((row) => ({
    id: row.id,
    ruleType: row.rule_type,
    tokenSymbol: row.token_symbol,
    targetPct: row.target_pct,
    triggerPrice: row.trigger_price,
    triggerDirection: row.trigger_direction,
    triggerAction: row.trigger_action,
    triggerAmountPct: row.trigger_amount_pct,
    thresholdPct: row.threshold_pct,
    createdBy: row.created_by,
    votingPowerUsed: row.voting_power_used,
    createdAt: row.created_at,
  }));
}

export function deactivateStrategyRule(ruleId: number): void {
  db.prepare("UPDATE strategy_rules SET is_active = 0, deactivated_at = datetime('now') WHERE id = ?").run(ruleId);
}

// --- Autonomous Trades ---

export function createAutonomousTrade(params: {
  strategyRuleId: number;
  tradeId?: number;
  fromSymbol: string;
  toSymbol: string;
  amountHuman: number;
  amountUsd: number;
  reason: string;
  txHash?: string;
  status?: string;
}): number {
  const result = db.prepare(`
    INSERT INTO autonomous_trades (strategy_rule_id, trade_id, from_symbol, to_symbol, amount_human, amount_usd, reason, tx_hash, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.strategyRuleId,
    params.tradeId ?? null,
    params.fromSymbol, params.toSymbol,
    params.amountHuman, params.amountUsd,
    params.reason,
    params.txHash ?? null,
    params.status ?? "pending"
  );
  return result.lastInsertRowid as number;
}

export function getAutonomousTradeHistory(limit = 50): Array<{
  id: number;
  strategyRuleId: number;
  tradeId: number | null;
  fromSymbol: string;
  toSymbol: string;
  amountHuman: number;
  amountUsd: number;
  reason: string;
  txHash: string | null;
  status: string;
  createdAt: string;
}> {
  const rows = db.prepare("SELECT * FROM autonomous_trades ORDER BY created_at DESC LIMIT ?").all(limit) as any[];
  return rows.map((row) => ({
    id: row.id,
    strategyRuleId: row.strategy_rule_id,
    tradeId: row.trade_id,
    fromSymbol: row.from_symbol,
    toSymbol: row.to_symbol,
    amountHuman: row.amount_human,
    amountUsd: row.amount_usd,
    reason: row.reason,
    txHash: row.tx_hash,
    status: row.status,
    createdAt: row.created_at,
  }));
}
