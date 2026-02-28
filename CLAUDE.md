# GHOST TREASURY — Final Execution Plan
# This is the CLAUDE.md for the project. Single source of truth.
# Supersedes ALL previous docs where they conflict.

## What We're Building

Ghost Treasury: a private AI-managed DAO treasury on Monad using Unlink's ZK privacy pool.

Members deposit funds into Unlink's privacy pool. A Claude-powered AI agent manages the treasury within member-defined constraints. The agent acquires market intelligence via x402 micropayments using burner accounts. All trades execute privately through Unlink's DeFi adapter. Three safety layers prevent the AI from going rogue.

**One sentence:** "An AI agent that manages a DAO's money privately — members deposit openly, the agent trades secretly, and no one on-chain can see the strategy."

## Why This Wins

- Targets Treasury track (1-3 competitors) + x402 Agents track (0-2 competitors)
- Uses 10+ Unlink SDK features (more than any other team)
- This hackathon is Unlink's LAUNCH EVENT — our project is their pitch deck material
- Hits all 4 judging pillars: technical execution, speed/shipping, use case/impact, demo/presentation
- Creates the "holy shit" moment: block explorer shows NO trace of the trade

## Chain & Network

Everything runs on Monad Testnet. Single chain. No bridging.

```
Chain ID:        10143
RPC:             https://testnet-rpc.monad.xyz
Block time:      400ms
Finality:        800ms (2 slots)
EVM version:     prague
Explorer:        https://testnet.monadscan.com
Gas model:       EIP-1559, CHARGED ON GAS LIMIT NOT GAS USED
```

## Critical Monad Patterns

### Use eth_sendRawTransactionSync (NOT eth_sendRawTransaction)

Kevin from Monad called this "WAY MORE IMPORTANT" than any other feature. Returns full receipt in ~800ms. No polling. EIP-7966.

```typescript
// WRONG — standard async, requires polling:
const txHash = await provider.send("eth_sendRawTransaction", [signedTx]);

// RIGHT — sync, returns receipt immediately:
const receipt = await provider.send("eth_sendRawTransactionSync", [signedTx]);
```

Use this for ALL on-chain writes: deposits, swaps, withdrawals, contract calls.

### Local Nonce Manager (Required)

Monad's eth_getTransactionCount only updates after finalization. Rapid sequential transactions WILL collide without local nonce tracking.

```typescript
class NonceManager {
  private nonces: Map<string, number> = new Map();

  async getNonce(address: string, provider: any): Promise<number> {
    if (!this.nonces.has(address)) {
      const n = await provider.getTransactionCount(address, "pending");
      this.nonces.set(address, n);
    }
    const nonce = this.nonces.get(address)!;
    this.nonces.set(address, nonce + 1);
    return nonce;
  }

  reset(address: string) { this.nonces.delete(address); }
}
```

### Gas Limits

Set tight gas limits. Monad charges on gas LIMIT, not gas USED. Over-estimating wastes MON.

## Key Addresses

```
Unlink Pool:           0x0813da0a10328e5ed617d37e514ac2f6fa49a254
Native MON:            0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
USDC (Monad testnet):  0x534b2f3A21130d7a60830c2Df862319e593943A3
WMON:                  0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A
Permit2:               0x000000000022d473030f116ddee9f6b43ac78ba3
x402 Facilitator:      https://x402-facilitator.molandak.org
Unlink Gateway:        https://api.unlink.xyz (free, no auth)
DeFi Adapter:          ASK PAUL HENRY — not in docs
```

## Tech Stack

### Frontend (React + Vite)
```
react, react-dom, @unlink-xyz/react, ethers, vite, tailwindcss, typescript
```

### Backend (Node.js + Express)
```
@anthropic-ai/sdk, @unlink-xyz/node, @unlink-xyz/core,
@x402/fetch, @x402/core, @x402/evm,
express, cors, better-sqlite3
```

### Demo APIs (x402-gated price feeds)
```
express, @x402/express, @x402/core, cors
```

### Contracts
```
Foundry (foundryup --network monad), Solidity 0.8.x, evmVersion: prague
```

## Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
PRIVATE_KEY=0x...           # deployer wallet
AGENT_PRIVATE_KEY=0x...     # agent wallet (for x402 + DeFi)
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
UNLINK_CHAIN=monad-testnet
X402_FACILITATOR_URL=https://x402-facilitator.molandak.org
DEMO_MODE=false
```

## Project Structure

```
ghost-treasury/
├── .env
├── package.json                    # monorepo root
├── packages/
│   ├── shared/src/
│   │   ├── types.ts                # all interfaces
│   │   └── constants.ts            # addresses, chain IDs
│   ├── backend/src/
│   │   ├── index.ts                # Express server (:3001)
│   │   ├── agent/
│   │   │   ├── core.ts             # Claude tool-use loop
│   │   │   ├── tools.ts            # balance, swap, research, report
│   │   │   └── validator.ts        # constraint enforcement
│   │   ├── routes/
│   │   │   ├── agent.ts            # POST /api/agent/chat
│   │   │   ├── treasury.ts         # GET /api/treasury/state
│   │   │   └── activity.ts         # GET /api/activity (SSE)
│   │   └── services/
│   │       ├── unlink.ts           # @unlink-xyz/node wrapper
│   │       ├── x402.ts             # @x402/fetch wrapper
│   │       ├── blockchain.ts       # sendRawTransactionSync + NonceManager
│   │       └── demo.ts             # cached responses fallback
│   ├── frontend/src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Dashboard.tsx       # treasury overview
│   │   │   ├── AgentChat.tsx       # THE core demo screen
│   │   │   ├── DepositPanel.tsx    # deposit into privacy pool
│   │   │   ├── ActivityFeed.tsx    # agent action log
│   │   │   └── TreasuryStats.tsx   # allocation chart
│   │   └── hooks/
│   │       ├── useAgent.ts
│   │       └── useTreasury.ts
│   ├── demo-apis/src/
│   │   ├── index.ts                # Express + x402 middleware (:3002)
│   │   └── feeds/price.ts          # x402-gated ETH/USDC prices
│   └── contracts/
│       ├── foundry.toml            # evmVersion = "prague"
│       └── src/GhostVault.sol      # on-chain constraint enforcement
```

## Unlink SDK Usage

### Init (Node.js backend)
```typescript
import { initUnlink, createSqliteStorage } from "@unlink-xyz/node";

const unlink = await initUnlink({
  chain: "monad-testnet",
  storage: createSqliteStorage({ path: "./wallet.db" }),
});
```

### Check Balances
```typescript
const balances = await unlink.getBalances();
// Returns: { token: address, amount: bigint }[]
```

### DeFi Adapter (Atomic Private Swap)
```typescript
await unlink.interact({
  adapterAddress: DEFI_ADAPTER_ADDRESS,
  inputs: [{ token: USDC_ADDRESS, amount: parseUnits("5000", 6) }],
  calls: [
    { to: USDC_ADDRESS, data: approveCalldata },
    { to: ROUTER_ADDRESS, data: swapCalldata },
  ],
  reshields: [{ token: WETH_ADDRESS, minAmount: minEthOut }],
});
```

### Burner Accounts (for x402)
```typescript
await unlink.fundBurner(0, { token: USDC_ADDRESS, amount: parseUnits("1", 6) });
const burnerAddress = unlink.burnerAddressOf(0);
// Use burner private key for x402 client signer
```

### Privacy Model
| Operation | Amount | Sender | Recipient | Token |
|-----------|--------|--------|-----------|-------|
| Deposit   | PUBLIC | PUBLIC | PRIVATE   | PUBLIC |
| Transfer  | PRIVATE| PRIVATE| PRIVATE   | PRIVATE|
| Withdraw  | PUBLIC | PRIVATE| PUBLIC    | PUBLIC |

## x402 Integration

### Server (Demo Price API)
```typescript
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const server = new x402ResourceServer(
  new HTTPFacilitatorClient({ url: "https://x402-facilitator.molandak.org" })
);
server.register("eip155:10143", new ExactEvmScheme());

app.use(paymentMiddleware({
  "GET /price/eth": {
    accepts: {
      scheme: "exact",
      network: "eip155:10143",
      payTo: PAYMENT_RECEIVER_ADDRESS,
      price: "$0.001",
    },
    description: "ETH price feed",
  },
}, server));
```

### Client (Agent buys data)
```typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client();
registerExactEvmScheme(client, {
  signer: privateKeyToAccount(BURNER_PRIVATE_KEY),
});
const payFetch = wrapFetchWithPayment(fetch, client);
const res = await payFetch("http://localhost:3002/price/eth");
```

## Claude Agent Architecture

### Tool-Use Loop (~60 lines)
```typescript
import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic();

async function runAgent(userMessage: string): AsyncGenerator<AgentEvent> {
  const messages = [{ role: "user", content: userMessage }];

  while (true) {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: TREASURY_SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    // Yield text blocks for streaming to frontend
    for (const block of response.content) {
      if (block.type === "text") yield { type: "text", text: block.text };
    }

    if (response.stop_reason !== "tool_use") break;

    // Execute tool calls
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        yield { type: "tool_call", name: block.name, input: block.input };
        const result = await executeTool(block.name, block.input);
        yield { type: "tool_result", name: block.name, result };
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }
}
```

### Tool Definitions
```typescript
const TOOL_DEFINITIONS = [
  {
    name: "check_balance",
    description: "Check treasury balances via Unlink viewing key",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_price",
    description: "Fetch asset price via x402 micropayment from burner account",
    input_schema: {
      type: "object",
      properties: { asset: { type: "string", enum: ["ETH", "USDC", "MON"] } },
      required: ["asset"],
    },
  },
  {
    name: "execute_swap",
    description: "Execute a private swap via Unlink DeFi adapter",
    input_schema: {
      type: "object",
      properties: {
        from_token: { type: "string" },
        to_token: { type: "string" },
        amount: { type: "string" },
      },
      required: ["from_token", "to_token", "amount"],
    },
  },
  {
    name: "generate_report",
    description: "Generate a treasury status report for members",
    input_schema: { type: "object", properties: {} },
  },
];
```

### System Prompt
```
You are Ghost, a private treasury manager for a DAO.

You manage funds inside an Unlink privacy pool on Monad. Your job is to execute the members' investment strategy while keeping all activity private from on-chain observers.

CONSTRAINTS (enforced by smart contract — you cannot override these):
- Maximum single trade: {maxTradePct}% of treasury value
- Allowed tokens: {allowedTokens}
- Minimum time between trades: {cooldownMinutes} minutes

TOOLS:
- check_balance: See current treasury holdings via viewing key
- get_price: Buy real-time price data via x402 (costs $0.001 per request from burner account)
- execute_swap: Execute a private swap via DeFi adapter (atomic unshield-swap-reshield)
- generate_report: Create a summary for members

RULES:
1. Always check constraints before trading
2. Explain your reasoning to members in plain English
3. If a trade would violate constraints, explain why and suggest an alternative
4. Never reveal private keys, viewing keys, or internal wallet addresses
5. When in doubt, do NOT trade — preserving capital is the priority
```

## Safety Architecture

```
User Request → Claude Proposes Action
                    ↓
            [Layer 1: Claude Self-Check]
            "Does this violate constraints?"
                    ↓
            [Layer 2: App Validator]
            validateTrade(action, constraints)
            Hard-coded checks in application code
                    ↓
            [Layer 3: GhostVault.sol]
            On-chain contract enforces:
            - caller == authorized agent
            - epochSpent + amount <= dailyCap
            - not paused by member
                    ↓
            EXECUTE or REJECT
```

## Demo Mode Fallback

```typescript
const DEMO_RESPONSES = {
  balance: {
    text: "Treasury holds $52,340: 40,825 USDC (78%), 3.12 ETH (15%), 1,200 MON (7%)",
    data: { USDC: 40825, ETH: 3.12, MON: 1200 },
  },
  rebalance: {
    text: "Fetching ETH price via x402... paid $0.001 from burner. ETH = $3,847. Executing swap: 5,000 USDC → 1.298 ETH via DeFi adapter. Trade complete. Fully private.",
    data: { swap: { from: "USDC", to: "ETH", amount: 5000, received: 1.298 } },
  },
  reject: {
    text: "Rejected. Your rules cap trades at 10% of treasury. This request would exceed the limit. Even if I wanted to execute this, the on-chain constraint contract would block it.",
    data: null,
  },
};

// Toggle: DEMO_MODE=true in .env, or auto-fallback on Claude timeout (8s)
```

## The 5 Demo Interactions (The One Thing That Wins)

If we ship nothing else, these 5 chat interactions are the demo:

1. **"What's our position?"** → Agent queries Unlink balances, shows allocation
2. **"Rebalance to 60/40 ETH/USDC"** → Agent buys price via x402, checks constraints, executes private swap
3. **"Show me on the block explorer"** → Open MonadScan, transaction shows pool call, NO trace of who/what/how much
4. **"Swap 100% to memecoin"** → Agent REJECTS, explains constraint
5. **"Who can see our strategy?"** → Agent explains viewing keys, compliance model

## Judging (4 Pillars, Equal Weight)

1. **Technical Execution** — Deep SDK usage, sendRawTransactionSync, nonce manager, 3-layer safety
2. **Speed and Shipping** — Complete working product, not broken ambitious prototype
3. **Use Case and Impact** — $25B+ in exposed DAO treasuries, real MEV losses
4. **Demo and Presentation** — The "Find the Trade" moment on block explorer

Judges are RANDOM — 2 per room, 4 rooms. Assignment at 12:30 PM Sunday.

## Pitch Script (3 Minutes)

**0:00** "DAO treasuries hold $25 billion on public blockchains. Every trade visible. MEV bots front-run them. It's poker with your cards face up."

**0:25** [LIVE DEMO] Deposit 100 USDC → privacy pool. Show MonadScan: pool received tokens, but WHO? The pool.

**0:55** [AGENT CHAT] "Check ETH price and buy if under $4000" → Agent pays via x402, checks constraints, executes private swap via DeFi adapter. 800ms confirmation via sendRawTransactionSync.

**1:30** [THE MOMENT] Open MonadScan. "Find the amount. Find the trader. Find the strategy. You can't."

**2:00** [SAFETY] "Swap 100% to memecoin" → Agent rejects. Smart contract enforces.

**2:30** [CLOSE] "Permissionless, self-custodial, open source. Privacy isn't a feature — it's the prerequisite for institutional DeFi."

## Q&A Quick Reference

| Judge | Lead With | Key Phrase |
|-------|-----------|------------|
| Iqram (Venmo) | UX simplicity, "three clicks" | "Your mom could check her share" |
| Viktor (Coinbase) | Privacy as infrastructure | "Compliant privacy, not anonymity" |
| Sean C (Aztec) | Public vs private breakdown | Precise about what's hidden vs visible |
| David Wong (ZK-Sec) | Threat model, trust assumptions | "Trust: Unlink relayer. Mitigation: funds stay safe if it fails" |
| Jonah (BC Cap) | $25B TAM, investability | "First 10 customers from DAOs with MEV-loss governance proposals" |
| Fitz (Monad) | 10K TPS, sendRawTransactionSync | "Single-call confirmation, local nonce manager" |
| Jason (EF) | Say these exact words | "Permissionless, self-custodial, privacy-first, open source" |
| Aryan (CMT) | Institutional angle | "How institutions will manage crypto treasuries" |

## Timeline

| When | What |
|------|------|
| Fri 9 PM | Hacking starts. Scaffold monorepo, all servers running by midnight. |
| Sat 8 AM | Core build. Agent loop, Unlink service, x402 fetch, React dashboard. |
| Sat 12 PM | Monad mentors arrive (until 4 PM). Ask sendRawTransactionSync, gas. |
| Sat 4 PM | Integration. Wire everything together. Full stack smoke test. |
| Sat 8 PM | Polish. Dark theme, animations, demo data, demo mode testing. |
| Sat 10 PM | STOP adding features. Polish only. |
| Sun 8 AM | Submit prep. Record backup video, write DoraHacks, rehearse 5x. |
| Sun 9 AM | STOP fixing bugs. Rehearse only. |
| Sun 11:45 AM | SUBMIT. No exceptions. |
| Sun 12:00 PM | Deadline. |
| Sun 12:30 PM | Room assignments (Google Sheets). |
| Sun 1-4 PM | Judging. |
| Sun 4 PM | Winners announced. |

## Pre-Build Checklist

```
[ ] Generate 2 private keys (openssl rand -hex 32)
[ ] Verify ANTHROPIC_API_KEY works
[ ] Hit ALL faucets: monad.xyz, quicknode, alchemy, chainlink, ethglobal, gas.zip, morkie, unlink
[ ] Download docs.monad.xyz/llms-full.txt for AI context
[ ] Install MonDeployer: git clone https://github.com/adrianmonad/MonDeployer.git
[ ] Talk to Paul Henry TONIGHT: DeFi adapter address, burner key export, pool tokens
[ ] Join Telegram: https://t.me/+OWyoLUv9CW9iOTJk
```

## Decision Points (Hard Stops)

| Time | If Not Working | Action |
|------|---------------|--------|
| Midnight Fri | Scaffold not running | Simplify to 2 packages (backend + frontend) |
| Sat noon | Agent loop not working | Activate demo mode for all responses |
| Sat 6 PM | DeFi adapter not working | Mock swaps with realistic timing |
| Sat 10 PM | Any feature not done | Cut it. Polish what works. |
| Sun 9 AM | Any bug remaining | Leave it. Rehearse pitch instead. |

## What Makes Paul Henry Put This in His Pitch Deck

- Uses 10+ Unlink SDK features (deposit, withdraw, DeFi adapter, burner accounts, viewing keys, multisig, balance queries, transfers, history, auto-sync)
- Echo his language: "compliant privacy," "five lines of code," "make existing blockchains private"
- UI looks investor-grade: dark theme, real data viz, no broken states
- File bugs through feedback form (Slacks his engineers, shows we're power users)

## Reference Docs

- Unlink: https://docs.unlink.xyz
- Monad: https://docs.monad.xyz
- x402: https://docs.cdp.coinbase.com/x402/welcome
- Claude API: https://docs.anthropic.com/en/docs
- Monad x402 Guide: https://docs.monad.xyz/guides/x402-guide
- MonDeployer: https://github.com/adrianmonad/MonDeployer
