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
