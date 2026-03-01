import type { TreasuryConstraints } from "@ghost/shared";
import {
  DEFAULT_MAX_TRADE_PCT,
  DEFAULT_COOLDOWN_MINUTES,
  DEFAULT_ALLOWED_TOKENS,
  RPC_URL,
} from "@ghost/shared";
import { createPublicClient, createWalletClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sendRawTransactionSync, nonceManager } from "../services/blockchain.js";
import { monadTestnet } from "../config.js";
import type Database from "better-sqlite3";

const GHOST_VAULT_RECORD_ABI = [
  {
    inputs: [
      { name: "fromToken", type: "address" },
      { name: "toToken", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "recordTrade",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const GHOST_VAULT_ABI = [
  {
    inputs: [
      { name: "fromToken", type: "address" },
      { name: "toToken", type: "address" },
      { name: "amountBps", type: "uint256" },
    ],
    name: "validateTrade",
    outputs: [
      { name: "allowed", type: "bool" },
      { name: "reason", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  suggestion?: string;
}

// Track last trade timestamps per agent
const lastTradeTime: Map<string, number> = new Map();

// Mutable constraints — defaults loaded, can be changed via agent governance
let currentConstraints: TreasuryConstraints = {
  maxTradePct: DEFAULT_MAX_TRADE_PCT,
  cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
  allowedTokens: [...DEFAULT_ALLOWED_TOKENS],
  paused: false,
};

export function getConstraints(): TreasuryConstraints {
  return { ...currentConstraints, allowedTokens: [...currentConstraints.allowedTokens] };
}

export function setConstraint(key: string, value: unknown): { success: boolean; error?: string } {
  switch (key) {
    case "maxTradePct": {
      const num = Number(value);
      if (isNaN(num) || num < 1 || num > 100) return { success: false, error: "maxTradePct must be 1-100" };
      currentConstraints.maxTradePct = num;
      return { success: true };
    }
    case "cooldownMinutes": {
      const num = Number(value);
      if (isNaN(num) || num < 0 || num > 1440) return { success: false, error: "cooldownMinutes must be 0-1440" };
      currentConstraints.cooldownMinutes = num;
      return { success: true };
    }
    case "paused": {
      currentConstraints.paused = value === true || value === "true";
      return { success: true };
    }
    default:
      return { success: false, error: `Unknown constraint: ${key}` };
  }
}

export function loadConstraints(db: Database.Database): void {
  // Restore last-approved settings from the DB
  const rows = db.prepare(
    "SELECT setting_key, new_value FROM settings_changes WHERE approved = 1 ORDER BY created_at ASC"
  ).all() as Array<{ setting_key: string; new_value: string }>;

  for (const row of rows) {
    setConstraint(row.setting_key, row.new_value);
  }
}

export function validateTrade(params: {
  fromToken: string;
  toToken: string;
  amountUsd: number;
  totalTreasuryUsd: number;
  agentId?: string;
}): ValidationResult {
  const constraints = getConstraints();

  // Check if paused
  if (constraints.paused) {
    return {
      allowed: false,
      reason: "Treasury operations are paused by member vote.",
      suggestion: "Wait for members to unpause the treasury.",
    };
  }

  // Check allowed tokens
  const fromAllowed = constraints.allowedTokens.some(
    (t) => t.toLowerCase() === params.fromToken.toLowerCase()
  );
  const toAllowed = constraints.allowedTokens.some(
    (t) => t.toLowerCase() === params.toToken.toLowerCase()
  );

  if (!fromAllowed || !toAllowed) {
    return {
      allowed: false,
      reason: `Token not in allowed list. Only ${constraints.allowedTokens.length} tokens are approved for trading.`,
      suggestion: "Members must vote to add new tokens to the allowed list.",
    };
  }

  // Check trade size limit
  if (params.totalTreasuryUsd > 0) {
    const tradePct = (params.amountUsd / params.totalTreasuryUsd) * 100;
    if (tradePct > constraints.maxTradePct) {
      const maxAmount = Math.floor((constraints.maxTradePct / 100) * params.totalTreasuryUsd);
      return {
        allowed: false,
        reason: `Trade is ${tradePct.toFixed(1)}% of treasury value, exceeding the ${constraints.maxTradePct}% maximum.`,
        suggestion: `Maximum trade size is $${maxAmount.toLocaleString()} (${constraints.maxTradePct}% of $${params.totalTreasuryUsd.toLocaleString()}).`,
      };
    }
  }

  // Check cooldown
  const agentId = params.agentId ?? "default";
  const lastTrade = lastTradeTime.get(agentId);
  if (lastTrade) {
    const elapsedMs = Date.now() - lastTrade;
    const cooldownMs = constraints.cooldownMinutes * 60 * 1000;
    if (elapsedMs < cooldownMs) {
      const remainingMin = Math.ceil((cooldownMs - elapsedMs) / 60000);
      return {
        allowed: false,
        reason: `Cooldown active. ${remainingMin} minute(s) remaining before next trade.`,
        suggestion: `Wait ${remainingMin} minutes before attempting another trade.`,
      };
    }
  }

  return { allowed: true };
}

// On-chain GhostVault validation (Layer 3)
export async function validateTradeOnChain(params: {
  fromToken: string;
  toToken: string;
  amountUsd: number;
  totalTreasuryUsd: number;
}): Promise<ValidationResult> {
  const vaultAddress = process.env.GHOST_VAULT_ADDRESS;
  if (!vaultAddress) {
    const failMode = process.env.VAULT_FAIL_MODE ?? "closed";
    if (failMode === "open") return { allowed: true };
    return {
      allowed: false,
      reason: "GhostVault not deployed. Trading blocked for safety.",
      suggestion: "Set GHOST_VAULT_ADDRESS in .env or set VAULT_FAIL_MODE=open for demo mode.",
    };
  }

  try {
    const client = createPublicClient({ transport: http(RPC_URL) });
    const amountBps = Math.round((params.amountUsd / params.totalTreasuryUsd) * 10000);

    const [allowed, reason] = await client.readContract({
      address: vaultAddress as `0x${string}`,
      abi: GHOST_VAULT_ABI,
      functionName: "validateTrade",
      args: [
        params.fromToken as `0x${string}`,
        params.toToken as `0x${string}`,
        BigInt(amountBps),
      ],
    });

    if (!allowed) {
      return {
        allowed: false,
        reason: `On-chain constraint: ${reason}`,
        suggestion: "GhostVault smart contract rejected this trade.",
      };
    }
    return { allowed: true };
  } catch (error: any) {
    const failMode = process.env.VAULT_FAIL_MODE ?? "closed";
    if (failMode === "open") {
      // Fail-open: allow trade if on-chain check fails (demo mode)
      console.warn(`[validator] On-chain check failed (fail-open): ${error.message}`);
      return { allowed: true };
    }
    // Fail-closed: block trade if on-chain check fails (default, secure)
    console.warn(`[validator] On-chain check failed (fail-closed): ${error.message}`);
    return {
      allowed: false,
      reason: "On-chain validation unavailable. Trading blocked for safety.",
      suggestion: "Set VAULT_FAIL_MODE=open in .env to allow trades when on-chain validation is unavailable.",
    };
  }
}

export async function recordTrade(
  agentId: string = "default",
  tradeInfo?: { fromToken: string; toToken: string; amount: bigint }
) {
  // Layer 1: In-memory (always — for cooldown enforcement)
  lastTradeTime.set(agentId, Date.now());

  // Layer 2: On-chain via sendRawTransactionSync (fire-and-forget)
  const vaultAddress = process.env.GHOST_VAULT_ADDRESS;
  const agentKey = process.env.TREASURY_AGENT_KEY;
  if (!vaultAddress || !agentKey || !tradeInfo) return;

  try {
    const account = privateKeyToAccount(agentKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(RPC_URL),
    });

    const nonce = await nonceManager.getNonce(account.address);
    const data = encodeFunctionData({
      abi: GHOST_VAULT_RECORD_ABI,
      functionName: "recordTrade",
      args: [
        tradeInfo.fromToken as `0x${string}`,
        tradeInfo.toToken as `0x${string}`,
        tradeInfo.amount,
      ],
    });

    const signedTx = await walletClient.signTransaction({
      to: vaultAddress as `0x${string}`,
      data,
      nonce,
      gas: 100_000n,
    });

    const receipt = await sendRawTransactionSync(signedTx);
    console.log(`[validator] Trade recorded on-chain via sendRawTransactionSync: ${receipt.transactionHash ?? receipt}`);
  } catch (error: any) {
    console.warn(`[validator] On-chain recordTrade failed (non-blocking): ${error.message}`);
  }
}
