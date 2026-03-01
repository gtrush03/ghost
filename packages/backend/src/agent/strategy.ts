import type { ToolContext } from "./tools.js";
import { toolCheckBalance } from "./tools.js";
import { fetchPrice } from "../services/x402.js";
import { validateTrade, validateTradeOnChain, recordTrade, getConstraints } from "./validator.js";
import * as dbService from "../services/db.js";
import { USDC_ADDRESS, WMON_ADDRESS, NATIVE_MON } from "@ghost/shared";

const TOKEN_MAP: Record<string, string> = {
  USDC: USDC_ADDRESS,
  ETH: WMON_ADDRESS,
  WMON: WMON_ADDRESS,
  MON: NATIVE_MON,
};

const DECIMALS: Record<string, number> = {
  USDC: 6,
  ETH: 18,
  WMON: 18,
  MON: 18,
};

const SLIPPAGE_BPS = parseInt(process.env.SLIPPAGE_BPS ?? "300");

let strategyInterval: ReturnType<typeof setInterval> | null = null;
let lastEvaluation: string | null = null;
let isRunning = false;

export function startStrategyLoop(ctx: ToolContext): void {
  if (strategyInterval) return;
  console.log("[strategy] Starting autonomous trading loop (60s interval)");

  strategyInterval = setInterval(() => evaluateRules(ctx), 60_000);
  // Also run once immediately after a short delay
  setTimeout(() => evaluateRules(ctx), 5_000);
}

export function stopStrategyLoop(): void {
  if (strategyInterval) {
    clearInterval(strategyInterval);
    strategyInterval = null;
    console.log("[strategy] Stopped autonomous trading loop");
  }
}

export function getStrategyStatus(): { running: boolean; lastEvaluation: string | null } {
  return { running: !!strategyInterval, lastEvaluation };
}

async function evaluateRules(ctx: ToolContext): Promise<void> {
  if (isRunning) return; // prevent overlapping evaluations
  isRunning = true;

  try {
    const constraints = getConstraints();
    if (constraints.paused) {
      console.log("[strategy] Treasury paused — skipping evaluation");
      return;
    }

    const rules = dbService.getActiveStrategyRules();
    if (rules.length === 0) return;

    // Get current balances
    const balanceResult = await toolCheckBalance(ctx) as { balances: Record<string, string>; totalValueUsd: number };
    const totalUsd = balanceResult.totalValueUsd;
    if (totalUsd <= 0) return;

    // Compute current allocations
    const prices: Record<string, number> = { USDC: 1 };
    const allocations: Record<string, number> = {};

    for (const [symbol, amountStr] of Object.entries(balanceResult.balances)) {
      const amount = parseFloat(amountStr);
      // Fetch price if not USDC
      if (symbol !== "USDC" && !prices[symbol]) {
        try {
          const p = await fetchPrice(symbol === "WMON" ? "MON" : symbol, ctx.priceFeedUrl, ctx.burnerKey);
          prices[symbol] = p.price;
        } catch {
          prices[symbol] = 0;
        }
      }
      const valueUsd = amount * (prices[symbol] ?? 0);
      allocations[symbol] = totalUsd > 0 ? (valueUsd / totalUsd) * 100 : 0;
    }

    console.log(`[strategy] Evaluating ${rules.length} rules. Allocations:`, allocations);

    for (const rule of rules) {
      try {
        await evaluateRule(rule, allocations, prices, totalUsd, ctx);
      } catch (err: any) {
        console.error(`[strategy] Rule #${rule.id} error: ${err.message}`);
      }
    }

    lastEvaluation = new Date().toISOString();
  } catch (err: any) {
    console.error(`[strategy] Evaluation error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

async function evaluateRule(
  rule: ReturnType<typeof dbService.getActiveStrategyRules>[number],
  allocations: Record<string, number>,
  prices: Record<string, number>,
  totalUsd: number,
  ctx: ToolContext
): Promise<void> {
  const symbol = rule.tokenSymbol ?? "USDC";
  const currentPct = allocations[symbol] ?? 0;

  switch (rule.ruleType) {
    case "allocation": {
      if (rule.targetPct == null) return;
      const drift = currentPct - rule.targetPct;
      const threshold = rule.thresholdPct ?? 5; // default 5% drift threshold
      if (Math.abs(drift) <= threshold) return;

      // Need to rebalance
      if (drift > 0) {
        // Over-allocated — sell some of this token for USDC
        const sellPct = drift;
        const sellUsd = (sellPct / 100) * totalUsd;
        await executeStrategyTrade(symbol, "USDC", sellUsd, prices, totalUsd, rule, ctx,
          `Rebalancing: ${symbol} is ${currentPct.toFixed(1)}%, target is ${rule.targetPct}%. Selling ~$${sellUsd.toFixed(0)}`);
      } else {
        // Under-allocated — buy more with USDC
        const buyPct = Math.abs(drift);
        const buyUsd = (buyPct / 100) * totalUsd;
        await executeStrategyTrade("USDC", symbol, buyUsd, prices, totalUsd, rule, ctx,
          `Rebalancing: ${symbol} is ${currentPct.toFixed(1)}%, target is ${rule.targetPct}%. Buying ~$${buyUsd.toFixed(0)}`);
      }
      break;
    }

    case "price_trigger": {
      if (rule.triggerPrice == null || !rule.triggerDirection || !rule.triggerAction) return;
      const currentPrice = prices[symbol] ?? 0;
      if (currentPrice <= 0) return;

      const triggered =
        (rule.triggerDirection === "below" && currentPrice < rule.triggerPrice) ||
        (rule.triggerDirection === "above" && currentPrice > rule.triggerPrice);

      if (!triggered) return;

      const tradePct = rule.triggerAmountPct ?? 10;
      const tradeUsd = (tradePct / 100) * totalUsd;

      if (rule.triggerAction === "buy") {
        await executeStrategyTrade("USDC", symbol, tradeUsd, prices, totalUsd, rule, ctx,
          `Price trigger: ${symbol} at $${currentPrice.toFixed(2)} (${rule.triggerDirection} $${rule.triggerPrice}). Buying ~$${tradeUsd.toFixed(0)}`);
      } else {
        await executeStrategyTrade(symbol, "USDC", tradeUsd, prices, totalUsd, rule, ctx,
          `Price trigger: ${symbol} at $${currentPrice.toFixed(2)} (${rule.triggerDirection} $${rule.triggerPrice}). Selling ~$${tradeUsd.toFixed(0)}`);
      }

      // Deactivate after trigger fires (one-shot)
      dbService.deactivateStrategyRule(rule.id);
      break;
    }

    case "rebalance_threshold": {
      if (rule.thresholdPct == null || rule.targetPct == null) return;
      const drift = Math.abs(currentPct - rule.targetPct);
      if (drift <= rule.thresholdPct) return;

      const adjustUsd = ((drift) / 100) * totalUsd;
      if (currentPct > rule.targetPct) {
        await executeStrategyTrade(symbol, "USDC", adjustUsd, prices, totalUsd, rule, ctx,
          `Threshold rebalance: ${symbol} drifted ${drift.toFixed(1)}% from target. Selling ~$${adjustUsd.toFixed(0)}`);
      } else {
        await executeStrategyTrade("USDC", symbol, adjustUsd, prices, totalUsd, rule, ctx,
          `Threshold rebalance: ${symbol} drifted ${drift.toFixed(1)}% from target. Buying ~$${adjustUsd.toFixed(0)}`);
      }
      break;
    }
  }
}

async function executeStrategyTrade(
  fromSymbol: string,
  toSymbol: string,
  amountUsd: number,
  prices: Record<string, number>,
  totalUsd: number,
  rule: ReturnType<typeof dbService.getActiveStrategyRules>[number],
  ctx: ToolContext,
  reason: string
): Promise<void> {
  const fromAddress = TOKEN_MAP[fromSymbol];
  const toAddress = TOKEN_MAP[toSymbol];
  if (!fromAddress || !toAddress) return;

  // Validate through safety layers
  const validation = validateTrade({
    fromToken: fromAddress,
    toToken: toAddress,
    amountUsd,
    totalTreasuryUsd: totalUsd,
    agentId: `strategy:${rule.id}`,
  });

  if (!validation.allowed) {
    console.log(`[strategy] Rule #${rule.id} blocked by validator: ${validation.reason}`);
    return;
  }

  const onChainCheck = await validateTradeOnChain({
    fromToken: fromAddress,
    toToken: toAddress,
    amountUsd,
    totalTreasuryUsd: totalUsd,
  });

  if (!onChainCheck.allowed) {
    console.log(`[strategy] Rule #${rule.id} blocked on-chain: ${onChainCheck.reason}`);
    return;
  }

  // Calculate amounts
  const fromPrice = prices[fromSymbol] ?? 1;
  const amountHuman = amountUsd / fromPrice;
  const decimals = DECIMALS[fromSymbol] ?? 18;
  const amountRaw = BigInt(Math.floor(amountHuman * 10 ** decimals));

  // Calculate minAmountOut
  let minAmountOut = 0n;
  try {
    const toPrice = prices[toSymbol] ?? 1;
    if (toPrice > 0) {
      const outDecimals = DECIMALS[toSymbol] ?? 18;
      const expectedOut = amountUsd / toPrice;
      const withSlippage = expectedOut * (1 - SLIPPAGE_BPS / 10000);
      minAmountOut = BigInt(Math.floor(withSlippage * 10 ** outDecimals));
    }
  } catch { /* accept any output */ }

  // Record trade in DB first
  const tradeId = dbService.createTrade({
    fromToken: fromAddress,
    fromSymbol,
    toToken: toAddress,
    toSymbol,
    amountIn: amountRaw.toString(),
    amountInHuman: amountHuman,
    amountUsd: Math.round(amountUsd * 100) / 100,
    status: "pending",
    initiatedBy: `strategy:${rule.id}`,
    strategyRuleId: rule.id,
  });

  try {
    const { DEX_ROUTER_ADDRESS } = await import("@ghost/shared");
    const result = await ctx.unlinkService.executeSwap({
      tokenIn: fromAddress,
      tokenOut: toAddress,
      amountIn: amountRaw,
      minAmountOut,
      dexRouter: DEX_ROUTER_ADDRESS,
    });

    // Update trade status
    dbService.updateTradeStatus(tradeId, result.status ?? "confirmed", result.txHash);

    // Record autonomous trade
    dbService.createAutonomousTrade({
      strategyRuleId: rule.id,
      tradeId,
      fromSymbol,
      toSymbol,
      amountHuman,
      amountUsd: Math.round(amountUsd * 100) / 100,
      reason,
      txHash: result.txHash,
      status: result.status ?? "confirmed",
    });

    // Log activity
    dbService.logActivity({
      eventType: "autonomous_trade",
      refId: tradeId,
      summary: `[Auto] ${reason}`,
      details: { ruleId: rule.id, fromSymbol, toSymbol, amountUsd, txHash: result.txHash },
      privacy: "private",
    });

    // Record for cooldown
    await recordTrade(`strategy:${rule.id}`, {
      fromToken: fromAddress,
      toToken: toAddress,
      amount: amountRaw,
    });

    console.log(`[strategy] Rule #${rule.id} executed: ${fromSymbol} → ${toSymbol}, $${amountUsd.toFixed(2)}, tx: ${result.txHash}`);
  } catch (err: any) {
    dbService.updateTradeStatus(tradeId, "failed");
    console.error(`[strategy] Rule #${rule.id} trade failed: ${err.message}`);
  }
}
