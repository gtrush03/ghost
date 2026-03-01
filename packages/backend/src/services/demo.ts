import type { AgentEvent } from "@ghost/shared";

// Demo mode: cached responses for the 5 demo interactions
// Used when DEMO_MODE=true or as fallback on LLM timeout

interface DemoResponse {
  text: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown>; result: unknown }>;
}

const DEMO_RESPONSES: Record<string, DemoResponse> = {
  position: {
    text: "Here's our current treasury position:\n\n" +
      "**Total Value: $52,340**\n" +
      "- 40,825 USDC (78.0%)\n" +
      "- 3.12 ETH (15.0%) — $12,005 @ $3,847\n" +
      "- 1,200 MON (7.0%) — $504 @ $0.42\n\n" +
      "All funds are shielded in the Unlink privacy pool. No on-chain observer can see this allocation.",
    toolCalls: [
      { name: "check_balance", input: {}, result: { USDC: "40825", ETH: "3.12", MON: "1200", totalUsd: 52340 } },
    ],
  },

  rebalance: {
    text: "Executing rebalance to 60/40 ETH/USDC...\n\n" +
      "1. Fetched ETH price via x402 micropayment: **$3,847.50** (paid $0.001 from burner)\n" +
      "2. Constraint check: Trade is 9.5% of treasury — within 10% limit\n" +
      "3. Executing swap: **5,000 USDC -> 1.298 ETH** via Unlink DeFi adapter\n" +
      "4. Swap confirmed in 800ms (sendRawTransactionSync)\n\n" +
      "New allocation: 60% ETH / 40% USDC. The swap was fully private — " +
      "the block explorer shows a call to the Unlink pool, but the amount, tokens, and strategy are invisible.",
    toolCalls: [
      { name: "get_price", input: { asset: "ETH" }, result: { asset: "ETH", price: 3847.5 } },
      { name: "execute_swap", input: { from_token: "USDC", to_token: "ETH", amount: "5000" }, result: { status: "succeeded", txHash: "0xdemo..." } },
    ],
  },

  reject: {
    text: "**Trade rejected.**\n\n" +
      "Your constraint rules cap any single trade at **10% of treasury value**. " +
      "Swapping 100% to a memecoin would violate this limit.\n\n" +
      "Even if I wanted to execute this, the on-chain GhostVault constraint contract would block it. " +
      "Three safety layers protect your funds:\n" +
      "1. My own constraint check (just failed)\n" +
      "2. Application-level validator\n" +
      "3. On-chain smart contract enforcement\n\n" +
      "Suggestion: You could swap up to 10% ($5,234) per trade, with a 5-minute cooldown between trades.",
    toolCalls: [],
  },

  privacy: {
    text: "Great question. Here's exactly who can see what:\n\n" +
      "**Public (anyone with a block explorer):**\n" +
      "- That *someone* deposited tokens into the Unlink pool\n" +
      "- That *something* interacted with the pool (DeFi adapter calls)\n\n" +
      "**Private (invisible on-chain):**\n" +
      "- WHO deposited (your identity)\n" +
      "- HOW MUCH is in our treasury\n" +
      "- WHAT tokens we hold\n" +
      "- WHEN and HOW we trade\n" +
      "- Our entire investment strategy\n\n" +
      "**Who CAN see our strategy:**\n" +
      "- Treasury members (via viewing keys)\n" +
      "- Compliance auditors (if you share the viewing key)\n" +
      "- No one else. Not MEV bots, not competitors, not chain analysts.\n\n" +
      "This is *compliant privacy* — you choose who gets transparency.",
    toolCalls: [],
  },

  explorer: {
    text: "Check the block explorer at https://testnet.monadscan.com\n\n" +
      "When you look at our last trade, you'll see:\n" +
      "- A transaction TO the Unlink pool contract (`0x0813...a254`)\n" +
      "- Gas paid by the relayer\n" +
      "- **That's it.**\n\n" +
      "You **cannot** see:\n" +
      "- The trade amount\n" +
      "- Which tokens were swapped\n" +
      "- Who initiated the trade\n" +
      "- The resulting balances\n\n" +
      "This is the power of Unlink's ZK privacy pool on Monad. " +
      "The atomic unshield-swap-reshield happens in a single transaction, " +
      "fully private, with 800ms finality.",
    toolCalls: [],
  },
};

// Pattern matchers for demo mode
const PATTERNS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /rebalance|allocat|60.*40|40.*60|swap.*eth.*usdc|swap.*usdc.*eth/i, key: "rebalance" },
  { pattern: /100%|memecoin|meme|all.*in|yolo|rug/i, key: "reject" },
  { pattern: /explorer|block.*scan|monadscan|on.chain|find.*trade/i, key: "explorer" },
  { pattern: /privacy|who.*see|visible|secret|strategy|viewing.*key/i, key: "privacy" },
  { pattern: /position|(?<![re])balance|hold|portfolio|what.*we.*have/i, key: "position" },
];

export function matchDemoResponse(message: string): DemoResponse | null {
  for (const { pattern, key } of PATTERNS) {
    if (pattern.test(message)) {
      return DEMO_RESPONSES[key] ?? null;
    }
  }
  return null;
}

export function* streamDemoResponse(message: string): Generator<AgentEvent> {
  const demo = matchDemoResponse(message);
  if (!demo) {
    yield { type: "text", text: "I'm Ghost, your private treasury manager. I can check balances, execute trades, fetch prices, and explain our privacy model. What would you like to do?" };
    yield { type: "done" };
    return;
  }

  // Yield tool calls first
  for (const tc of demo.toolCalls ?? []) {
    yield { type: "tool_call", name: tc.name, input: tc.input };
    yield { type: "tool_result", name: tc.name, result: tc.result };
  }

  yield { type: "text", text: demo.text };
  yield { type: "done" };
}

export const isDemoMode = () => process.env.DEMO_MODE === "true";
