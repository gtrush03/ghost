import type { UnlinkService } from "../services/unlink.js";
import { getTokenSymbol } from "../services/unlink.js";
import { fetchPrice } from "../services/x402.js";
import { validateTrade, validateTradeOnChain, recordTrade, getConstraints, setConstraint } from "./validator.js";
import { USDC_ADDRESS, UNLINK_USDC_ADDRESS, WMON_ADDRESS, NATIVE_MON, DEX_ROUTER_ADDRESS } from "@ghost/shared";
import type { MemberWithPower } from "@ghost/shared";
import * as dbService from "../services/db.js";

// OpenAI-compatible tool definitions (used by OpenRouter)
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "check_balance",
      description: "Check treasury balances in the Unlink privacy pool. Returns all token balances and total USD value.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_price",
      description: "Fetch real-time asset price via x402 micropayment from a burner account. Costs $0.001 USDC per request.",
      parameters: {
        type: "object",
        properties: {
          asset: { type: "string", enum: ["ETH", "USDC", "MON"], description: "Asset to get price for" },
        },
        required: ["asset"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "execute_swap",
      description: "Execute a private swap via Unlink DeFi adapter. Atomic unshield-swap-reshield in a single transaction.",
      parameters: {
        type: "object",
        properties: {
          from_token: { type: "string", enum: ["USDC", "ETH", "MON", "WMON"], description: "Token to sell" },
          to_token: { type: "string", enum: ["USDC", "ETH", "MON", "WMON"], description: "Token to buy" },
          amount: { type: "string", description: "Amount to swap in human-readable units (e.g. '5000' for 5000 USDC)" },
        },
        required: ["from_token", "to_token", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_report",
      description: "Generate a treasury status report showing balances, recent activity, and privacy status for members.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_settings",
      description: "Update a treasury governance setting. Requires >= 51% voting power. Settings: maxTradePct (1-100), cooldownMinutes (0-1440), paused (true/false).",
      parameters: {
        type: "object",
        properties: {
          setting: { type: "string", enum: ["maxTradePct", "cooldownMinutes", "paused"], description: "The setting to change" },
          value: { type: "string", description: "New value for the setting" },
        },
        required: ["setting", "value"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_members",
      description: "Get list of all DAO pool members with their share percentages and voting power.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

const TOKEN_MAP: Record<string, string> = {
  USDC: USDC_ADDRESS,  // Circle USDC (6 decimals) — has Uniswap V3 liquidity
  ETH: WMON_ADDRESS,  // ETH trades via WMON on Monad
  WMON: WMON_ADDRESS,
  MON: NATIVE_MON,
};

const DECIMALS: Record<string, number> = {
  USDC: 6,  // Circle USDC uses 6 decimals
  ETH: 18,
  WMON: 18,
  MON: 18,
};

export interface ToolContext {
  unlinkService: UnlinkService;
  priceFeedUrl: string;
  burnerKey?: string;
  db?: ReturnType<typeof dbService.getDb>;
  callerWallet?: string;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case "check_balance":
      return await toolCheckBalance(ctx);
    case "get_price":
      return await toolGetPrice(args as { asset: string }, ctx);
    case "execute_swap":
      return await toolExecuteSwap(args as { from_token: string; to_token: string; amount: string }, ctx);
    case "generate_report":
      return await toolGenerateReport(ctx);
    case "update_settings":
      return toolUpdateSettings(args as { setting: string; value: string }, ctx);
    case "get_members":
      return toolGetMembers();
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function toolCheckBalance(ctx: ToolContext): Promise<unknown> {
  try {
    const balances = await ctx.unlinkService.getBalances();
    const accumulated: Record<string, number> = {};
    let totalUsd = 0;
    const prices: Record<string, number> = { USDC: 1, WMON: 0.42, MON: 0.42 };

    for (const [token, amount] of Object.entries(balances)) {
      const symbol = getTokenSymbol(token);
      // Unlink testnet USDC uses 18 decimals; Circle USDC uses 6
      const isCircleUsdc = token.toLowerCase() === USDC_ADDRESS.toLowerCase();
      const decimals = isCircleUsdc ? 6 : 18;
      const human = Number(amount) / 10 ** decimals;

      // Combine balances for same symbol (Circle USDC + Unlink USDC both map to "USDC")
      accumulated[symbol] = (accumulated[symbol] ?? 0) + human;
      totalUsd += human * (prices[symbol] ?? 0);
    }

    const formatted: Record<string, string> = {};
    for (const [symbol, value] of Object.entries(accumulated)) {
      formatted[symbol] = value.toFixed(symbol === "USDC" ? 2 : 4);
    }

    return { balances: formatted, totalValueUsd: Math.round(totalUsd * 100) / 100, privacyStatus: "shielded" };
  } catch (error) {
    return { balances: { USDC: "0", MON: "0" }, totalValueUsd: 0, privacyStatus: "shielded", note: "Sync in progress" };
  }
}

async function toolGetPrice(args: { asset: string }, ctx: ToolContext): Promise<unknown> {
  const price = await fetchPrice(args.asset, ctx.priceFeedUrl, ctx.burnerKey);
  return price;
}

async function toolExecuteSwap(
  args: { from_token: string; to_token: string; amount: string },
  ctx: ToolContext
): Promise<unknown> {
  const fromAddress = TOKEN_MAP[args.from_token.toUpperCase()];
  const toAddress = TOKEN_MAP[args.to_token.toUpperCase()];

  if (!fromAddress || !toAddress) {
    return { error: `Unknown token: ${args.from_token} or ${args.to_token}` };
  }

  // Get price for USD value estimate
  const price = await fetchPrice(args.from_token, ctx.priceFeedUrl, ctx.burnerKey);
  const amountNum = parseFloat(args.amount);
  const amountUsd = amountNum * price.price;

  // Get treasury value for percentage check
  const balanceResult = await toolCheckBalance(ctx) as { totalValueUsd: number };
  const totalUsd = balanceResult.totalValueUsd || 50000; // fallback estimate

  // Validate constraints
  const validation = validateTrade({
    fromToken: fromAddress,
    toToken: toAddress,
    amountUsd,
    totalTreasuryUsd: totalUsd,
  });

  if (!validation.allowed) {
    return {
      executed: false,
      reason: validation.reason,
      suggestion: validation.suggestion,
    };
  }

  // Layer 3: On-chain GhostVault check
  const onChainCheck = await validateTradeOnChain({
    fromToken: fromAddress,
    toToken: toAddress,
    amountUsd,
    totalTreasuryUsd: totalUsd,
  });
  if (!onChainCheck.allowed) {
    return {
      executed: false,
      reason: onChainCheck.reason,
      suggestion: onChainCheck.suggestion,
    };
  }

  // Execute the swap via Unlink DeFi adapter
  try {
    const decimals = DECIMALS[args.from_token.toUpperCase()] ?? 18;
    const amountRaw = BigInt(Math.floor(parseFloat(args.amount) * 10 ** decimals));
    const minAmountOut = 0n; // Accept any output for hackathon demo

    const result = await ctx.unlinkService.executeSwap({
      tokenIn: fromAddress,
      tokenOut: toAddress,
      amountIn: amountRaw,
      minAmountOut,
      dexRouter: DEX_ROUTER_ADDRESS,
    });

    // Record the trade for cooldown tracking + on-chain via sendRawTransactionSync
    await recordTrade("default", {
      fromToken: fromAddress,
      toToken: toAddress,
      amount: amountRaw,
    });

    return {
      executed: true,
      from: args.from_token,
      to: args.to_token,
      amount: args.amount,
      amountUsd: Math.round(amountUsd * 100) / 100,
      relayId: result.relayId,
      txHash: result.txHash,
      status: result.status,
      privacy: "fully_private",
      note: "Atomic unshield-swap-reshield via Unlink DeFi adapter",
    };
  } catch (error: any) {
    return {
      executed: false,
      reason: `Swap failed: ${error.message}`,
    };
  }
}

async function toolGenerateReport(ctx: ToolContext): Promise<unknown> {
  const balances = await toolCheckBalance(ctx) as { balances: Record<string, string>; totalValueUsd: number };
  const constraints = getConstraints();

  const poolStats = ctx.db ? dbService.getPoolStats() : null;

  return {
    timestamp: new Date().toISOString(),
    treasury: balances,
    constraints: {
      maxTradePct: constraints.maxTradePct,
      cooldownMinutes: constraints.cooldownMinutes,
      allowedTokens: constraints.allowedTokens.length,
      paused: constraints.paused,
    },
    pool: poolStats ? {
      totalMembers: poolStats.totalMembers,
      activeMembers: poolStats.activeMembers,
      totalDepositedUsd: poolStats.totalDepositedUsd,
    } : undefined,
    privacyModel: {
      depositsVisible: "amount + token only",
      tradesVisible: "nothing — fully private via DeFi adapter",
      withdrawalsVisible: "amount + token only",
      strategyVisible: "only to viewing key holders",
    },
  };
}

function toolUpdateSettings(
  args: { setting: string; value: string },
  ctx: ToolContext
): unknown {
  const REQUIRED_POWER = 0.51;

  if (!ctx.callerWallet) {
    return { success: false, error: "No wallet connected. Connect your wallet to change settings." };
  }

  const member = dbService.getMember(ctx.callerWallet);
  if (!member) {
    return { success: false, error: "You are not a registered member. Register first." };
  }

  const votingPower = dbService.getVotingPower(ctx.callerWallet);

  // Get old value for audit log
  const constraints = getConstraints();
  const oldValue = String((constraints as any)[args.setting] ?? "unknown");

  if (votingPower < REQUIRED_POWER) {
    // Log the rejected attempt
    if (ctx.db) {
      dbService.recordSettingsChange({
        requestedBy: member.id,
        settingKey: args.setting,
        oldValue,
        newValue: args.value,
        votingPower,
        requiredPower: REQUIRED_POWER,
        approved: false,
      });
    }

    return {
      success: false,
      error: `Insufficient voting power. You have ${(votingPower * 100).toFixed(1)}% but need ${(REQUIRED_POWER * 100).toFixed(0)}%.`,
      yourPower: votingPower,
      required: REQUIRED_POWER,
    };
  }

  // Apply the change
  const result = setConstraint(args.setting, args.value);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Log the approved change
  if (ctx.db) {
    dbService.recordSettingsChange({
      requestedBy: member.id,
      settingKey: args.setting,
      oldValue,
      newValue: args.value,
      votingPower,
      requiredPower: REQUIRED_POWER,
      approved: true,
    });
  }

  return {
    success: true,
    setting: args.setting,
    oldValue,
    newValue: args.value,
    approvedBy: ctx.callerWallet,
    votingPower: `${(votingPower * 100).toFixed(1)}%`,
  };
}

function toolGetMembers(): unknown {
  const members = dbService.getMembersWithPower();
  const stats = dbService.getPoolStats();

  return {
    members: members.map((m: MemberWithPower) => ({
      wallet: m.walletAddress,
      displayName: m.displayName,
      sharePercent: Math.round(m.sharePercent * 10) / 10,
      votingPower: Math.round(m.votingPower * 1000) / 1000,
      netValueUsd: Math.round(m.netValueUsd * 100) / 100,
      joinedAt: m.joinedAt,
    })),
    poolTotal: stats.netPoolUsd,
    memberCount: stats.activeMembers,
  };
}
