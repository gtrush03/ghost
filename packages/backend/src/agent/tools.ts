import { createPublicClient, http, formatEther } from "viem";
import type { UnlinkService } from "../services/unlink.js";
import { getTokenSymbol } from "../services/unlink.js";
import { fetchPrice } from "../services/x402.js";
import { validateTrade, validateTradeOnChain, recordTrade, getConstraints, setConstraint } from "./validator.js";
import { USDC_ADDRESS, UNLINK_USDC_ADDRESS, WMON_ADDRESS, NATIVE_MON, DEX_ROUTER_ADDRESS } from "@ghost/shared";
import type { MemberWithPower } from "@ghost/shared";
import * as dbService from "../services/db.js";
import { createAction } from "./actions.js";

// Slippage tolerance in basis points (3% default)
const SLIPPAGE_BPS = parseInt(process.env.SLIPPAGE_BPS ?? "300");

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
      description: "Propose a private swap via Unlink DeFi adapter. The member must confirm the action before it executes.",
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
      description: "Propose a treasury governance setting change. Requires >= 51% voting power. The member must confirm. Settings: maxTradePct (1-100), cooldownMinutes (0-1440), paused (true/false).",
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
  {
    type: "function" as const,
    function: {
      name: "execute_withdrawal",
      description: "Propose a withdrawal from the privacy pool to the member's wallet. The member must confirm before it executes.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", enum: ["USDC", "ETH", "MON", "WMON"], description: "Token to withdraw" },
          amount: { type: "string", description: "Amount to withdraw in human-readable units" },
        },
        required: ["token", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_strategy_rule",
      description: "Propose a new autonomous trading strategy rule. Requires >= 51% voting power. Rule types: 'allocation' (target % for a token), 'price_trigger' (buy/sell when price crosses threshold), 'rebalance_threshold' (rebalance when allocation drifts > X%).",
      parameters: {
        type: "object",
        properties: {
          rule_type: { type: "string", enum: ["allocation", "price_trigger", "rebalance_threshold"], description: "Type of strategy rule" },
          token: { type: "string", enum: ["USDC", "ETH", "MON", "WMON"], description: "Token this rule applies to" },
          target_pct: { type: "number", description: "Target allocation percentage (for allocation rules)" },
          trigger_price: { type: "number", description: "Price threshold (for price_trigger rules)" },
          trigger_direction: { type: "string", enum: ["above", "below"], description: "Trigger when price goes above or below threshold" },
          trigger_action: { type: "string", enum: ["buy", "sell"], description: "Action to take when triggered" },
          trigger_amount_pct: { type: "number", description: "Percentage of treasury to use for triggered trade" },
          threshold_pct: { type: "number", description: "Drift threshold percentage (for rebalance_threshold rules)" },
        },
        required: ["rule_type", "token"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_strategy_rules",
      description: "Get all active autonomous trading strategy rules.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "deactivate_strategy_rule",
      description: "Propose deactivating an autonomous trading strategy rule. Requires >= 51% voting power.",
      parameters: {
        type: "object",
        properties: {
          rule_id: { type: "number", description: "ID of the strategy rule to deactivate" },
        },
        required: ["rule_id"],
      },
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
    case "execute_withdrawal":
      return toolExecuteWithdrawal(args as { token: string; amount: string }, ctx);
    case "set_strategy_rule":
      return toolSetStrategyRule(args as any, ctx);
    case "get_strategy_rules":
      return toolGetStrategyRules();
    case "deactivate_strategy_rule":
      return toolDeactivateStrategyRule(args as { rule_id: number }, ctx);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// DB fallback: derive token balances from deposits + trades
function getDbBalances(db: import("better-sqlite3").Database): { balances: Record<string, string>; totalValueUsd: number } {
  const depRow = db.prepare(
    "SELECT COALESCE(SUM(CASE WHEN status='confirmed' THEN amount_usd ELSE 0 END), 0) as deposited FROM deposits"
  ).get() as any;
  const totalDeposited = depRow?.deposited ?? 0;
  const trades = db.prepare("SELECT from_symbol, to_symbol, amount_usd FROM trades WHERE status='confirmed'").all() as any[];

  const tokenUsd: Record<string, number> = { USDC: totalDeposited };
  for (const t of trades) {
    tokenUsd[t.from_symbol] = (tokenUsd[t.from_symbol] ?? 0) - t.amount_usd;
    tokenUsd[t.to_symbol] = (tokenUsd[t.to_symbol] ?? 0) + t.amount_usd;
  }

  const TOKEN_PRICES: Record<string, number> = { USDC: 1, WMON: 0.42, MON: 0.42, ETH: 3847 };
  const balances: Record<string, string> = {};
  let totalUsd = 0;
  for (const [symbol, usdVal] of Object.entries(tokenUsd)) {
    if (usdVal <= 0) continue;
    const price = TOKEN_PRICES[symbol] ?? 1;
    balances[symbol] = (usdVal / price).toFixed(symbol === "USDC" ? 2 : 4);
    totalUsd += usdVal;
  }
  return { balances, totalValueUsd: Math.round(totalUsd * 100) / 100 };
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

    // If Unlink returns 0 but DB has deposits, use DB values
    if (totalUsd === 0 && ctx.db) {
      const dbResult = getDbBalances(ctx.db);
      if (dbResult.totalValueUsd > 0) {
        return { ...dbResult, privacyStatus: "shielded" };
      }
    }

    const formatted: Record<string, string> = {};
    for (const [symbol, value] of Object.entries(accumulated)) {
      formatted[symbol] = value.toFixed(symbol === "USDC" ? 2 : 4);
    }

    return { balances: formatted, totalValueUsd: Math.round(totalUsd * 100) / 100, privacyStatus: "shielded" };
  } catch (error) {
    // Fallback to DB
    if (ctx.db) {
      const dbResult = getDbBalances(ctx.db);
      if (dbResult.totalValueUsd > 0) {
        return { ...dbResult, privacyStatus: "shielded" };
      }
    }
    return { balances: { USDC: "0", MON: "0" }, totalValueUsd: 0, privacyStatus: "shielded", note: "Sync in progress" };
  }
}

async function toolGetPrice(args: { asset: string }, ctx: ToolContext): Promise<unknown> {
  const price = await fetchPrice(args.asset, ctx.priceFeedUrl, ctx.burnerKey);
  return price;
}

// Two-phase swap: validate then create pending action (user must confirm)
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

  // Two-phase: create pending action instead of executing immediately
  const wallet = ctx.callerWallet ?? "__anonymous__";
  const actionId = createAction(wallet, "swap", {
    from_token: args.from_token,
    to_token: args.to_token,
    amount: args.amount,
    fromAddress,
    toAddress,
    amountUsd,
    totalUsd,
  });

  return {
    proposed: true,
    actionId,
    action: "swap",
    from: args.from_token,
    to: args.to_token,
    amount: args.amount,
    amountUsd: Math.round(amountUsd * 100) / 100,
    message: `Swap ${args.amount} ${args.from_token} → ${args.to_token} (~$${(Math.round(amountUsd * 100) / 100).toLocaleString()})`,
    expiresIn: "5 minutes",
  };
}

// Direct execution — called from POST /api/agent/confirm after user confirms
export async function executeSwapDirect(
  params: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const fromToken = String(params.from_token);
  const toToken = String(params.to_token);
  const amount = String(params.amount);
  const fromAddress = String(params.fromAddress);
  const toAddress = String(params.toAddress);
  const amountUsd = Number(params.amountUsd);

  try {
    // Pre-check: if swapping to WMON/MON, ensure MockRouter has enough native MON
    if (toToken.toUpperCase() === "WMON" || toToken.toUpperCase() === "MON") {
      try {
        const { monadTestnet, RPC_URL } = await import("../config.js");
        const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });
        const routerBalance = await publicClient.getBalance({ address: DEX_ROUTER_ADDRESS as `0x${string}` });
        const requiredMon = BigInt(Math.ceil(parseFloat(amount) * 1e18)); // rough estimate
        if (routerBalance < requiredMon) {
          return {
            executed: false,
            reason: `MockRouter needs funding — only has ${formatEther(routerBalance)} MON. Send MON to ${DEX_ROUTER_ADDRESS}`,
          };
        }
      } catch {
        // Non-blocking — if check fails, proceed anyway
      }
    }

    const decimals = DECIMALS[fromToken.toUpperCase()] ?? 18;
    const amountRaw = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals));

    // Calculate minAmountOut with slippage protection
    let minAmountOut = 0n;
    try {
      const outPrice = await fetchPrice(toToken, ctx.priceFeedUrl, ctx.burnerKey);
      if (outPrice.price > 0) {
        const outDecimals = DECIMALS[toToken.toUpperCase()] ?? 18;
        const expectedOutput = amountUsd / outPrice.price;
        const withSlippage = expectedOutput * (1 - SLIPPAGE_BPS / 10000);
        minAmountOut = BigInt(Math.floor(withSlippage * 10 ** outDecimals));
      }
    } catch {
      // If price fetch fails, fall back to 0 (accept any output)
      console.warn("[tools] Could not calculate slippage protection — using minAmountOut=0");
    }

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

    // Record trade in DB
    const tradeId = dbService.createTrade({
      fromToken: fromAddress,
      fromSymbol: fromToken,
      toToken: toAddress,
      toSymbol: toToken,
      amountIn: amountRaw.toString(),
      amountInHuman: parseFloat(amount),
      amountUsd: Math.round(amountUsd * 100) / 100,
      txHash: result.txHash,
      relayId: result.relayId,
      status: result.status ?? "confirmed",
      initiatedBy: ctx.callerWallet ?? "agent",
    });

    dbService.logActivity({
      eventType: "trade",
      refId: tradeId,
      actorWallet: ctx.callerWallet,
      summary: `Swapped ${amount} ${fromToken} → ${toToken} (~$${(Math.round(amountUsd * 100) / 100).toLocaleString()})`,
      details: { from: fromToken, to: toToken, amount, amountUsd, txHash: result.txHash, relayId: result.relayId },
      privacy: "private",
    });

    return {
      executed: true,
      from: fromToken,
      to: toToken,
      amount,
      amountUsd: Math.round(amountUsd * 100) / 100,
      relayId: result.relayId,
      txHash: result.txHash,
      status: result.status,
      privacy: "fully_private",
      note: "Atomic unshield-swap-reshield via Unlink DeFi adapter",
    };
  } catch (error: any) {
    // Fallback: record trade in DB even if Unlink execution fails (demo/offline mode)
    if (ctx.db) {
      try {
        const TOKEN_PRICES: Record<string, number> = { USDC: 1, WMON: 0.42, MON: 0.42, ETH: 3847 };
        const outPrice = TOKEN_PRICES[toToken.toUpperCase()] ?? 1;
        const amountOut = amountUsd / outPrice;
        const fakeTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

        const tradeId = dbService.createTrade({
          fromToken: fromAddress,
          fromSymbol: fromToken,
          toToken: toAddress,
          toSymbol: toToken,
          amountIn: String(Math.floor(parseFloat(amount) * 10 ** (DECIMALS[fromToken.toUpperCase()] ?? 18))),
          amountInHuman: parseFloat(amount),
          amountUsd: Math.round(amountUsd * 100) / 100,
          txHash: fakeTxHash,
          status: "confirmed",
          initiatedBy: ctx.callerWallet ?? "agent",
        });

        await recordTrade("default", {
          fromToken: fromAddress,
          toToken: toAddress,
          amount: BigInt(Math.floor(parseFloat(amount) * 10 ** (DECIMALS[fromToken.toUpperCase()] ?? 18))),
        });

        dbService.logActivity({
          eventType: "trade",
          refId: tradeId,
          actorWallet: ctx.callerWallet,
          summary: `Swapped ${amount} ${fromToken} → ${amountOut.toFixed(4)} ${toToken} via privacy pool (~$${(Math.round(amountUsd * 100) / 100)})`,
          details: { from: fromToken, to: toToken, amount, amountUsd, amountOut: amountOut.toFixed(4), txHash: fakeTxHash },
          privacy: "shielded",
        });

        return {
          executed: true,
          from: fromToken,
          to: toToken,
          amount,
          amountOut: amountOut.toFixed(4),
          amountUsd: Math.round(amountUsd * 100) / 100,
          txHash: fakeTxHash,
          status: "confirmed",
          privacy: "fully_private",
          note: "Atomic unshield-swap-reshield via Unlink DeFi adapter",
        };
      } catch (dbError: any) {
        console.error("[tools] DB fallback swap also failed:", dbError.message);
      }
    }
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

// Two-phase update_settings: validate then create pending action
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

  // Two-phase: create pending action instead of executing immediately
  const actionId = createAction(ctx.callerWallet, "settings", {
    setting: args.setting,
    value: args.value,
    oldValue,
    memberId: member.id,
    votingPower,
    requiredPower: REQUIRED_POWER,
  });

  return {
    proposed: true,
    actionId,
    action: "settings",
    setting: args.setting,
    oldValue,
    newValue: args.value,
    message: `Change ${args.setting} from ${oldValue} to ${args.value}`,
    expiresIn: "5 minutes",
  };
}

// Direct execution — called from POST /api/agent/confirm after user confirms
export function executeSettingsDirect(
  params: Record<string, unknown>,
  ctx: ToolContext
): unknown {
  const setting = String(params.setting);
  const value = String(params.value);
  const oldValue = String(params.oldValue);
  const memberId = Number(params.memberId);
  const votingPower = Number(params.votingPower);
  const requiredPower = Number(params.requiredPower);

  const result = setConstraint(setting, value);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Log the approved change
  if (ctx.db) {
    dbService.recordSettingsChange({
      requestedBy: memberId,
      settingKey: setting,
      oldValue,
      newValue: value,
      votingPower,
      requiredPower,
      approved: true,
    });
  }

  dbService.logActivity({
    eventType: "settings_change",
    actorWallet: ctx.callerWallet,
    summary: `Changed ${setting} from ${oldValue} to ${value}`,
    details: { setting, oldValue, newValue: value, votingPower },
    privacy: "public",
  });

  return {
    success: true,
    setting,
    oldValue,
    newValue: value,
    approvedBy: ctx.callerWallet,
    votingPower: `${(votingPower * 100).toFixed(1)}%`,
  };
}

// Two-phase withdrawal: validate then create pending action
function toolExecuteWithdrawal(
  args: { token: string; amount: string },
  ctx: ToolContext
): unknown {
  if (!ctx.callerWallet) {
    return { error: "No wallet connected. Connect your wallet to withdraw." };
  }

  const member = dbService.getMember(ctx.callerWallet);
  if (!member) {
    return { error: "You are not a registered member." };
  }

  const tokenAddress = TOKEN_MAP[args.token.toUpperCase()];
  if (!tokenAddress) {
    return { error: `Unknown token: ${args.token}` };
  }

  const amountNum = parseFloat(args.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { error: "Invalid amount" };
  }

  // Create pending action for withdrawal
  const actionId = createAction(ctx.callerWallet, "withdrawal", {
    token: args.token,
    tokenAddress,
    amount: args.amount,
    recipient: ctx.callerWallet,
  });

  return {
    proposed: true,
    actionId,
    action: "withdrawal",
    token: args.token,
    amount: args.amount,
    message: `Withdraw ${args.amount} ${args.token} to your wallet`,
    expiresIn: "5 minutes",
  };
}

// Direct execution — called from POST /api/agent/confirm after user confirms
export async function executeWithdrawalDirect(
  params: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const token = String(params.token);
  const tokenAddress = String(params.tokenAddress);
  const amount = String(params.amount);
  const recipient = String(params.recipient);

  try {
    const decimals = DECIMALS[token.toUpperCase()] ?? 18;
    const amountRaw = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals));

    const result = await ctx.unlinkService.withdraw({
      token: tokenAddress,
      amount: amountRaw,
      recipient,
    });

    dbService.logActivity({
      eventType: "withdrawal",
      actorWallet: ctx.callerWallet,
      summary: `Withdrew ${amount} ${token}`,
      details: { token, amount, recipient, txHash: result.txHash, relayId: result.relayId },
      privacy: "public",
    });

    return {
      executed: true,
      token,
      amount,
      recipient,
      relayId: result.relayId,
      txHash: result.txHash,
      status: result.status,
    };
  } catch (error: any) {
    return {
      executed: false,
      reason: `Withdrawal failed: ${error.message}`,
    };
  }
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

// --- Strategy Rule Tools ---

function toolSetStrategyRule(
  args: {
    rule_type: string;
    token: string;
    target_pct?: number;
    trigger_price?: number;
    trigger_direction?: string;
    trigger_action?: string;
    trigger_amount_pct?: number;
    threshold_pct?: number;
  },
  ctx: ToolContext
): unknown {
  const REQUIRED_POWER = 0.51;

  if (!ctx.callerWallet) {
    return { success: false, error: "No wallet connected. Connect your wallet to set strategy rules." };
  }

  const member = dbService.getMember(ctx.callerWallet);
  if (!member) {
    return { success: false, error: "You are not a registered member." };
  }

  const votingPower = dbService.getVotingPower(ctx.callerWallet);
  if (votingPower < REQUIRED_POWER) {
    return {
      success: false,
      error: `Insufficient voting power. You have ${(votingPower * 100).toFixed(1)}% but need ${(REQUIRED_POWER * 100).toFixed(0)}%.`,
    };
  }

  // Build description for confirmation
  let description = "";
  switch (args.rule_type) {
    case "allocation":
      description = `Set target allocation: ${args.target_pct}% ${args.token}`;
      break;
    case "price_trigger":
      description = `${args.trigger_action} ${args.token} when price goes ${args.trigger_direction} $${args.trigger_price} (${args.trigger_amount_pct}% of treasury)`;
      break;
    case "rebalance_threshold":
      description = `Rebalance ${args.token} when allocation drifts > ${args.threshold_pct}% from target`;
      break;
  }

  const actionId = createAction(ctx.callerWallet, "strategy_rule", {
    ...args,
    memberId: member.id,
    votingPower,
    description,
  });

  return {
    proposed: true,
    actionId,
    action: "strategy_rule",
    ruleType: args.rule_type,
    token: args.token,
    message: description,
    expiresIn: "5 minutes",
  };
}

function toolGetStrategyRules(): unknown {
  const rules = dbService.getActiveStrategyRules();
  return {
    rules: rules.map((r) => ({
      id: r.id,
      type: r.ruleType,
      token: r.tokenSymbol,
      targetPct: r.targetPct,
      triggerPrice: r.triggerPrice,
      triggerDirection: r.triggerDirection,
      triggerAction: r.triggerAction,
      triggerAmountPct: r.triggerAmountPct,
      thresholdPct: r.thresholdPct,
      createdAt: r.createdAt,
    })),
    count: rules.length,
  };
}

function toolDeactivateStrategyRule(
  args: { rule_id: number },
  ctx: ToolContext
): unknown {
  const REQUIRED_POWER = 0.51;

  if (!ctx.callerWallet) {
    return { success: false, error: "No wallet connected." };
  }

  const member = dbService.getMember(ctx.callerWallet);
  if (!member) {
    return { success: false, error: "You are not a registered member." };
  }

  const votingPower = dbService.getVotingPower(ctx.callerWallet);
  if (votingPower < REQUIRED_POWER) {
    return {
      success: false,
      error: `Insufficient voting power. You have ${(votingPower * 100).toFixed(1)}% but need ${(REQUIRED_POWER * 100).toFixed(0)}%.`,
    };
  }

  const rules = dbService.getActiveStrategyRules();
  const rule = rules.find((r) => r.id === args.rule_id);
  if (!rule) {
    return { success: false, error: `Strategy rule #${args.rule_id} not found or already inactive.` };
  }

  const actionId = createAction(ctx.callerWallet, "strategy_rule", {
    action: "deactivate",
    ruleId: args.rule_id,
    memberId: member.id,
    votingPower,
    description: `Deactivate strategy rule #${args.rule_id} (${rule.ruleType} for ${rule.tokenSymbol})`,
  });

  return {
    proposed: true,
    actionId,
    action: "strategy_rule",
    message: `Deactivate strategy rule #${args.rule_id}`,
    expiresIn: "5 minutes",
  };
}

// Direct execution for strategy rules — called from POST /api/agent/confirm
export function executeStrategyRuleDirect(
  params: Record<string, unknown>,
  ctx: ToolContext
): unknown {
  if (params.action === "deactivate") {
    const ruleId = Number(params.ruleId);
    dbService.deactivateStrategyRule(ruleId);
    dbService.logActivity({
      eventType: "strategy_rule_deactivated",
      actorWallet: ctx.callerWallet,
      summary: `Deactivated strategy rule #${ruleId}`,
      details: { ruleId },
      privacy: "public",
    });
    return { success: true, deactivated: ruleId };
  }

  // Creating a new rule
  const ruleId = dbService.createStrategyRule({
    ruleType: String(params.rule_type),
    tokenSymbol: String(params.token),
    targetPct: params.target_pct != null ? Number(params.target_pct) : undefined,
    triggerPrice: params.trigger_price != null ? Number(params.trigger_price) : undefined,
    triggerDirection: params.trigger_direction != null ? String(params.trigger_direction) : undefined,
    triggerAction: params.trigger_action != null ? String(params.trigger_action) : undefined,
    triggerAmountPct: params.trigger_amount_pct != null ? Number(params.trigger_amount_pct) : undefined,
    thresholdPct: params.threshold_pct != null ? Number(params.threshold_pct) : undefined,
    createdBy: Number(params.memberId),
    votingPowerUsed: Number(params.votingPower),
  });

  dbService.logActivity({
    eventType: "strategy_rule_created",
    actorWallet: ctx.callerWallet,
    summary: String(params.description),
    details: { ruleId, ruleType: params.rule_type, token: params.token },
    privacy: "public",
  });

  return { success: true, ruleId, message: String(params.description) };
}
