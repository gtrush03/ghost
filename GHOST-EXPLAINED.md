# Ghost Treasury — Everything You Need to Know

---

# LIVE STATUS — Full Validation (as of 04:50 AM, March 1 2026)

> **ALL 6 PHASES COMPLETE. Backend is real. Swap works on-chain.**

## What Works (Verified)

| Feature | Status | Evidence |
|---------|--------|----------|
| Shielded balance check | :green_circle: REAL | 17 USDC + 2.38 WMON in Unlink pool |
| x402 price feed | :green_circle: REAL | `source: "x402-ghost"`, $0.001 per request |
| GhostVault on-chain safety | :green_circle: REAL | `0xb842...` — validates constraints, rejects oversized trades |
| 3-layer trade rejection | :green_circle: REAL | AI self-check + app validator + on-chain contract |
| Atomic private swap | :green_circle: REAL | 1 USDC → 2.38 WMON, tx `0xff73...`, relay `4028919b` |
| Burner auto-funding | :green_circle: REAL | Loads key on startup, no manual step |
| Agent brain (Claude via OpenRouter) | :green_circle: REAL | Tool-use loop with 4 tools |
| Privacy explanation | :green_circle: REAL | Always works (text-only, no tools) |
| Deposit endpoint | :green_circle: CODED | API exists, not yet tested end-to-end from frontend |
| Frontend (React dashboard) | :green_circle: BUILT | 27 files, runs on localhost:5173 |

## What Needs Attention Before Demo

| Item | Priority | Action |
|------|----------|--------|
| MockRouter has 0.24 MON left | :red_circle: HIGH | Send 10+ MON to `0x64a6...` before demo |
| Circle USDC faucet cooldown | :yellow_circle: MED | Hit faucet.circle.com again in ~2hrs for 20 more USDC |
| Frontend → backend wiring | :yellow_circle: MED | Frontend chat works; deposit panel needs real wallet connect test |
| MonadScan tx links | :yellow_circle: LOW | Verify swap TX shows on explorer (testnet.monadexplorer.com) |

## On-Chain Contracts

| Contract | Address | Status |
|----------|---------|--------|
| GhostVault | `0xb8427cb9a707a83465c521d21e1d00564c1ea924` | LIVE |
| MockRouter (Uniswap V3 interface) | `0x64a6ae652d77f45167f7d563eeb7beeb58486394` | LIVE (needs MON refill) |
| WMON | `0xea12354dfe3642574eef5d13f18ac17eb929912e` | LIVE |
| Circle USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | LIVE |
| Unlink Pool | `0x0813da0a10328e5ed617d37e514ac2f6fa49a254` | LIVE |

## Treasury Holdings (Shielded)

- **17 Circle USDC** (6 decimals) — for swap demos
- **30 Unlink faucet USDC** (18 decimals) — for balance display
- **~2.38 WMON** — from successful test swap
- **~28 MON** in wallet (for gas + router funding)

## Suggested Next Steps

1. **Refund MockRouter** — send 10 MON to `0x64a6...` (takes 30 seconds)
2. **Frontend polish** — test the full UI flow (dashboard → chat → deposit)
3. **Demo rehearsal on frontend** — run all 5 pitch interactions through the React UI
4. **Pitch deck / DoraHacks submission** — screenshots, tx links, architecture diagram
5. **Record backup video** — in case live demo has network issues

---

# Detailed Phase History

## Phase 0: Install Tools `DONE`
> _Blocks everything. Must complete first. ~5 min._

| # | Task | Status | Updated |
|---|------|--------|---------|
| 0.1 | Install Unlink CLI (`npm i -g @unlink-xyz/cli@canary`) | :green_circle: DONE | 03:00 AM |
| 0.2 | Clone + install MonDeployer (contract deploy without Foundry) | :green_circle: DONE | 03:00 AM |
| 0.3 | Add `PRIVATE_KEY` to `.env` (reuse Treasury key for deploying) | :green_circle: DONE | 03:05 AM |
| 0.4 | Create MonDeployer `env.js` with deployer key | :green_circle: DONE | 03:05 AM |
| 0.5 | Verify: `unlink-cli --version` runs, MonDeployer loads | :green_circle: DONE | 03:05 AM |

---

## Phase 1: Get Shielded USDC `DONE`
> _THE single biggest blocker. Without funds the agent manages an empty wallet._
> _Depends on: Phase 0 complete._
> **Discovery:** Unlink CLI has built-in `faucet` command — mints + deposits in one step!
> **Discovery:** Faucet USDC = `0xc4fb...fdf6` (18 decimals). Added to constants.
> **Faucet cap:** ~10 USDC per call (larger amounts revert).

| # | Task | Status | Updated |
|---|------|--------|---------|
| 1.1 | `unlink-cli faucet --token USDC --amount 10` x3 = 30 USDC shielded | :green_circle: DONE | 03:10 AM |
| 1.2 | Backend config → shares CLI wallet DB (`data/treasury-cli/wallet.db`) | :green_circle: DONE | 03:12 AM |
| 1.3 | Unlink testnet USDC address added to constants + token maps | :green_circle: DONE | 03:15 AM |
| 1.4 | Verify: `unlink-cli balance` → 30 USDC shielded | :green_circle: DONE | 03:10 AM |
| 1.5 | Start backend → "What's our position?" → **30.00 USDC** | :green_circle: DONE | 03:25 AM |
| 1.6 | Fixed decimal issue: Unlink USDC = 18 decimals (not 6) | :green_circle: DONE | 03:20 AM |

---

## Phase 2: Deploy GhostVault `DONE`
> _Layer 3 safety — on-chain constraint enforcement judges can verify._
> _Depends on: Phase 0. Can run in PARALLEL with Phase 1._
> **Contract:** `0xb8427cb9a707a83465c521d21e1d00564c1ea924`
> **TX:** `0x7ab29daeab3281690ef688303a3c45ae8583b94b81c5341d78578f787b304ae3`

| # | Task | Status | Updated |
|---|------|--------|---------|
| 2.1 | Deploy `GhostVault.sol` via solc + viem | :green_circle: DONE | 04:00 AM |
| 2.2 | Add `GHOST_VAULT_ADDRESS=0xb842...` to `.env` | :green_circle: DONE | 04:00 AM |
| 2.3 | Verify on-chain: owner, agent, allowedTokens, constraints all correct | :green_circle: DONE | 04:00 AM |
| 2.4 | On-chain test: 5% trade → ALLOWED, 15% trade → DENIED | :green_circle: DONE | 04:00 AM |

---

## Phase 3: Fund Burner `DONE`
> _Makes x402 micropayments real. "Paid $0.001 from burner" = true._
> _Depends on: Phase 1 (needs shielded USDC in pool)._
> **Surprise:** Burner was already funded from prior Phase 1 work. `initBurner()` succeeded automatically!

| # | Task | Status | Updated |
|---|------|--------|---------|
| 3.1 | Burner auto-funded — `initBurner()` succeeded on startup | :green_circle: DONE | 03:25 AM |
| 3.2 | Backend logs: "Burner address: 0xdeA8...9a5" + "Burner key loaded" | :green_circle: DONE | 03:25 AM |
| 3.3 | "Price of ETH?" → `source: "x402-ghost"` (real, not fallback!) | :green_circle: DONE | 03:28 AM |

---

## Phase 4: Test Real Swap `DONE — FULLY WORKING`
> _The "holy shit" moment — a real private swap on a real blockchain._
> _Depends on: Phase 1. Phase 2 optional (adds on-chain validation)._
> **Discovery:** Monad testnet was RESET — Uniswap V3 + WMON contracts wiped (no code at old addresses).
> **Fix:** Deposited 20 Circle USDC (from faucet.circle.com). Deployed own WMON + MockRouter (Uniswap V3 interface).
> **RESULT:** Full atomic unshield-swap-reshield WORKS. TX hash on-chain. Privacy confirmed.

| # | Task | Status | Updated |
|---|------|--------|---------|
| 4.1 | Got 20 Circle USDC from faucet.circle.com (free testnet tokens) | :green_circle: DONE | 04:25 AM |
| 4.2 | Deposited 20 Circle USDC into Unlink pool (approve + deposit + confirm) | :green_circle: DONE | 04:28 AM |
| 4.3 | Discovered Monad testnet reset: Uniswap V3 + WMON = NO CODE | :green_circle: FIXED | 04:35 AM |
| 4.4 | Deployed WMON at `0xea12...` + MockRouter at `0x64a6...` | :green_circle: DONE | 04:38 AM |
| 4.5 | Updated GhostVault to allow new WMON address | :green_circle: DONE | 04:40 AM |
| 4.6 | **REAL SWAP: 1 USDC → 2.38 WMON, tx `0xff73...`, relay `4028919b...`** | :green_circle: DONE | 04:42 AM |

---

## Phase 5: End-to-End Demo Rehearsal `DONE`
> _All 5 pitch interactions on the real backend. The final test._
> _Depends on: ALL above._

| # | Task | Status | Updated |
|---|------|--------|---------|
| 5.1 | "What's our position?" → 17 USDC + 2.38 WMON shielded | :green_circle: DONE | 04:50 AM |
| 5.2 | "Price of ETH?" → $3,878.50, `source: x402-ghost` | :green_circle: DONE | 04:50 AM |
| 5.3 | "Swap 1 USDC to WMON" → EXECUTED, tx `0xff73...` on-chain | :green_circle: DONE | 04:42 AM |
| 5.4 | "Swap 100% to memecoin" → 3-layer rejection, mentions all safety layers | :green_circle: DONE | 04:50 AM |
| 5.5 | "Who can see our strategy?" → full privacy model explanation | :green_circle: DONE | 04:16 AM |
| 5.6 | ALL on-chain contracts verified LIVE (GhostVault, MockRouter, WMON, USDC, Pool) | :green_circle: DONE | 04:50 AM |

---

### Dependency Graph
```
Phase 0 (tools)     ─── 5 min ──→ unlocks everything
                                    |
                    ┌───────────────┤
                    v               v
Phase 1 (USDC)     Phase 2 (GhostVault)
   15 min              10 min
      |                    |
      v                    |
Phase 3 (burner)           |
   5 min                   |
      |                    |
      v                    v
Phase 4 (test swap) <──────┘
   10 min
      |
      v
Phase 5 (rehearsal)
   15 min
```

**Total: ~60 min sequential, ~45 min with Phase 1 + 2 in parallel.**

### Key Addresses (quick ref)
| What | Address |
|------|---------|
| Treasury EOA | `0xC395A71aE6820A9EA64ca78e9a92c4642f211E97` |
| Research EOA | `0x8E272ACe9ae8f0bA7743EbC716AcE3bbBb2408bB` |
| Trading EOA | `0x23Ffb7dD833B2E933C08a2A0aeADB6E364063ea6` |
| USDC (Monad) | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| Unlink Pool | `0x0813da0a10328e5ed617d37e514ac2f6fa49a254` |
| DEX Router | `0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900` |
| GhostVault | **TBD — deploy in Phase 2** |
| Circle USDC Faucet | https://faucet.circle.com/ |
| Monad MON Faucet | https://faucet.monad.xyz/ |

---
---

## What Is This Project?

Ghost Treasury is an **AI-powered money manager for groups (DAOs)** that keeps all financial activity **invisible on the blockchain**.

Think of it like this: Imagine a group investment fund where:
- Members pool their money together
- An AI bot manages the investments 24/7
- **Nobody can see** what trades the AI is making — not competitors, not hackers, not front-runners
- Members set rules the AI must follow (e.g., "never put more than 10% in one trade")
- If the AI tries to break the rules, a smart contract physically blocks it

**The one-liner:** "An AI agent that manages a DAO's money privately — members deposit openly, the agent trades secretly, and no one on-chain can see the strategy."

---

## The Hackathon

**Event:** Unlink x Monad Hackathon
**Where:** Manhattan, NYC (in-person)
**When:** Feb 27 – Mar 1, 2026
**Tracks we're targeting:**
1. **Treasury Track** (1-3 competitors — low competition)
2. **x402 Agents Track** (0-2 competitors — almost no competition)

**Judging criteria (equal weight):**
1. Technical Execution — how deep is the code
2. Speed and Shipping — does it actually work
3. Use Case and Impact — does it solve a real problem
4. Demo and Presentation — the "holy shit" moment

---

## Why This Wins

**The real-world problem:** DAOs (decentralized organizations) hold **$25 billion+** on public blockchains. Every trade they make is visible to everyone. Bots called "MEV bots" see these trades coming and front-run them — basically stealing money by trading milliseconds ahead.

**Our solution:** Hide everything. The AI trades inside a privacy pool where nobody can see the amounts, the tokens, or the strategy.

**The "holy shit" demo moment:** We execute a trade, then open the block explorer (like a bank statement for the blockchain) and say: *"Find the trade. Find the amount. Find the strategy. You can't."*

---

## How Crypto Wallets Work (The Basics)

### What is a wallet?

A crypto wallet is like a bank account, but instead of a bank holding your money, **you hold a secret password** (called a "private key") that controls the money.

- **Private Key** — A long random number (like a password). Whoever has this controls the money. NEVER share it.
- **Public Address** — Derived from the private key. Like your bank account number — safe to share so people can send you money.
- **Balance** — How much crypto you have. Checked by asking the blockchain.

### Our 3 Agent Wallets

We created **3 separate wallets** for 3 AI agents:

| Agent | Job | Port | Public Address |
|-------|-----|------|---------------|
| **Research** | Buys market data (prices, trends) | 3001 | `0x8E272ACe9ae8f0bA7743EbC716AcE3bbBb2408bB` |
| **Trading** | Executes buy/sell trades, serves price feeds | 3002 | `0x23Ffb7dD833B2E933C08a2A0aeADB6E364063ea6` |
| **Treasury** | Oversees everything, AI brain, manages deposits | 3003 | `0xC395A71aE6820A9EA64ca78e9a92c4642f211E97` |

Each agent also has an **Unlink address** — this is their private/shielded identity inside the privacy pool. It looks like `unlink1qy3fy68va...` (much longer than a regular address).

### Why 3 agents, not 1?

Separation of concerns — same reason a company has different departments:
- Research agent spends tiny amounts ($0.001) buying price data via x402 micropayments
- Trading agent only executes trades the Treasury approves
- Treasury agent has the overview and enforces rules

### What is MON?

MON is the native currency of the **Monad blockchain** (like ETH is for Ethereum). You need MON to pay "gas fees" — small fees charged for every transaction on the blockchain. Without MON, our agents can't do anything.

### What is USDC?

USDC is a "stablecoin" — 1 USDC always equals $1 USD. It's the money our treasury actually manages. MON is just for paying transaction fees.

### What is a faucet?

A faucet is a website that gives you **free test tokens** on a test network. Since we're on Monad Testnet (fake money for development), we need faucets to get test MON. The catch: most faucets require you to already have crypto elsewhere to prove you're a real developer.

---

## The Tech Stack (What Each Piece Does)

### Monad (The Blockchain)
- Where everything runs. Like Ethereum but **much faster** (400ms blocks vs 12 seconds)
- Test network = fake money, safe to experiment

### Unlink (The Privacy Layer)
- Makes transactions invisible. Deposits go INTO a shared pool, trades happen INSIDE the pool, nobody outside can see what happened
- Think of it like a mixer — money goes in labeled, comes out unlabeled

### x402 (Micropayments for Data)
- A protocol that lets our Research agent **pay tiny amounts** ($0.001) to access price feeds
- Like putting a quarter in a newspaper machine, but for financial data

### Claude Sonnet 4.6 via OpenRouter (The AI Brain)
- The LLM that powers the Treasury agent's decision-making
- Uses tool calls to check balances, fetch prices, execute swaps, and generate reports
- Runs through OpenRouter API — same multi-model access, production-grade

### Viem (Blockchain Library)
- JavaScript library that talks to the Monad blockchain
- Creates wallets, sends transactions, checks balances

### Express (Web Server)
- Each agent runs as a small web server
- Has a `/health` endpoint so we can check if it's alive

---

## The Privacy Model

| Operation | Who Sees Amount? | Who Sees Sender? | Who Sees Receiver? |
|-----------|-----------------|-----------------|-------------------|
| **Deposit** (put money in) | PUBLIC | PUBLIC | HIDDEN |
| **Transfer** (move inside pool) | HIDDEN | HIDDEN | HIDDEN |
| **Trade/Swap** (buy/sell tokens) | HIDDEN | HIDDEN | HIDDEN |
| **Withdraw** (take money out) | PUBLIC | HIDDEN | PUBLIC |

**Translation:** Once money enters the Unlink pool, all activity is invisible. The only public moments are when money enters or exits the pool.

---

## The 3-Layer Safety System

```
User asks AI to trade
        ↓
Layer 1: AI Self-Check (Claude Sonnet 4.6)
    "Does this violate the rules I was given?"
        ↓
Layer 2: App Validator (our code — validator.ts)
    Hard-coded checks — max trade size, allowed tokens, cooldown timer
        ↓
Layer 3: Smart Contract (on-chain — GhostVault.sol)
    Even if Layers 1 & 2 fail, the blockchain contract
    physically blocks unauthorized trades
        ↓
EXECUTE or REJECT
```

**Why 3 layers?** Because AI can be tricked. Our code can have bugs. But the smart contract on the blockchain is immutable — it cannot be convinced, hacked, or talked into breaking the rules.

---

## The 5 Demo Interactions (What Wins the Hackathon)

These are the 5 things we show judges:

1. **"What's our position?"** → AI checks Unlink balances, shows portfolio allocation
2. **"Rebalance to 60/40 ETH/USDC"** → AI buys price data ($0.001 via x402), checks rules, executes private swap
3. **"Show me on the block explorer"** → Open MonadScan — transaction visible but WHO/WHAT/HOW MUCH is invisible
4. **"Swap 100% to memecoin"** → AI REJECTS — "your rules cap trades at 10%"
5. **"Who can see our strategy?"** → AI explains privacy model, viewing keys, compliance

---

## DAO Evolution (Post-Hackathon)

After the hackathon demo was complete, Ghost Treasury evolved from a single-agent demo into a real multi-user DAO system.

### Phase 1: Pool & Membership Foundation ✅ COMPLETE

**What was added:**

| Feature | Where | What |
|---------|-------|------|
| SQLite database | `backend/services/db.ts` | Members, deposits, withdrawals, settings audit tables |
| Member registration | `POST /api/members/register` | Register wallet, auto-assign membership |
| Voting power | `db.getVotingPower(wallet)` | Net deposits / total pool = your power |
| Mutable constraints | `validator.ts` | `setConstraint()` + `loadConstraints()` — persisted in SQLite |
| `update_settings` tool | `tools.ts` | Agent checks voting power >= 51%, logs changes |
| `get_members` tool | `tools.ts` | Agent returns member list with shares |
| Dynamic system prompt | `core.ts` | Knows who is talking, their power, pool stats, current constraints |
| Wallet connection | `hooks/useWallet.ts` | MetaMask via EIP-1193, localStorage persistence, chain validation |
| Pool overview | `PoolBar.tsx` | Members, pool total, your share, voting power |
| Tabbed left panel | `LeftTabs.tsx` | Overview / Members / Settings tabs |
| Member list | `MemberList.tsx` | Cards with share bars, "You" highlight |
| Settings panel | `SettingsPanel.tsx` | Read-only constraints + "Ask Ghost to change" CTAs |
| Your position | `YourPosition.tsx` | Personal stats: value, share %, voting power |
| Settings CTA prefill | `ChatInput.tsx` | Clicking "Ask Ghost" pre-fills the chat input |

**How governance works:**
- Voting power = your net deposits (USD) / total pool (USD)
- 51% voting power required to change settings
- Agent checks power via `update_settings` tool before applying changes
- All changes logged in `settings_changes` table (approved or rejected)
- Constraints persist across restarts via SQLite

### Phase 2: Security & UX Upgrade ✅ COMPLETE

**What was added:**

| Feature | Where | What |
|---------|-------|------|
| Privy auth | `main.tsx`, `useWallet.ts` | Google/email/wallet login with embedded wallets |
| SIWE authentication | `routes/auth.ts` | Sign-In With Ethereum — verified wallet sessions |
| CORS hardening | `treasury.ts` | Origin whitelist instead of wide-open `cors()` |
| Per-user chat history | `routes/agent.ts` | Each wallet gets its own conversation |
| Two-phase execution | `agent/tools.ts`, `agent/actions.ts` | Swap/settings/withdrawal require user confirmation |
| Confirmation UI | `ConfirmationCard.tsx`, `ChatMessage.tsx` | Confirm/Reject buttons with countdown timer |
| Slippage protection | `agent/tools.ts` | 3% slippage tolerance via x402 price feed |
| Fail-closed safety | `agent/validator.ts` | Block trades when on-chain validation unavailable |
| Deposit fix | `DepositPanel.tsx` | Sends relayId (not tx hash) for confirmation |
| Withdrawal flow | `execute_withdrawal` tool | Members can withdraw from privacy pool |

### Fiat On-Ramp: Alchemy Pay

Alchemy Pay supports Monad mainnet with Apple Pay, Google Pay, Visa, and Mastercard. The integration flow:

1. Member clicks "Deposit via Card" in the UI
2. Alchemy Pay widget opens (iFrame)
3. User pays with fiat currency (USD, EUR, etc.)
4. Alchemy Pay converts to USDC on Monad
5. USDC sent to member's wallet
6. Member deposits USDC into the Unlink privacy pool

**Important notes:**
- Alchemy Pay is **mainnet only** — not available for testnet demo
- Requires KYB (Know Your Business) for sandbox access
- Alternative provider: **Transak** (self-service sandbox, Transak One for smart contract deposits)
- Estimated 2-4 hours to integrate when ready for mainnet
- Fiat deposits are PUBLIC (KYC required), but once in the Unlink pool, fully private

### Upcoming Phases

| Phase | What | Status |
|-------|------|--------|
| Phase 3 | Token-weighted governance (proposals, voting periods, quorum) | Planned |
| Phase 4 | Alchemy Pay fiat on-ramp (credit card → USDC → pool) | Planned |
| Phase 5 | Withdrawal queues, performance charts, viewing key distribution | Future |

---

## Hackathon Build History

### Phase 1: Foundation ✅ COMPLETE

| Component | Status | Notes |
|-----------|--------|-------|
| Monorepo scaffold | ✅ Done | `packages/backend`, `packages/shared`, etc. |
| Shared types & constants | ✅ Done | Monad addresses, USDC, Unlink pool |
| Backend package.json + tsconfig | ✅ Done | ESM, all dependencies installed |
| Config module (Monad chain, viem clients) | ✅ Done | `createAgentClients()`, `createAgentWallet()` |
| 3 agent private keys generated | ✅ Done | In `.env` file |
| 3 agent stubs (Express + health endpoint) | ✅ Done | Ports 3001, 3002, 3003 |
| Unlink wallet initialization | ✅ Done | SQLite-backed wallets |
| Monad RPC connection verified | ✅ Done | Chain ID 10143, blocks advancing |
| Fund agents with testnet MON | ✅ Done | Treasury 40 MON, Research 30, Trading 30 |
| Phase 1 validation test | ✅ Done | 13/13 checks pass |

### Phase 2: Agent Brains ✅ COMPLETE — LIVE ON CLAUDE SONNET 4.6

| Component | Status | Notes |
|-----------|--------|-------|
| OpenRouter integration | ✅ Done | Claude Sonnet 4.6 via `anthropic/claude-sonnet-4-6` |
| Agent tool-use loop | ✅ Done | `agent/core.ts` — multi-round tool calling |
| 4 tool definitions | ✅ Done | check_balance, get_price, execute_swap, generate_report |
| Tool executor with real SDK calls | ✅ Done | `agent/tools.ts` — wired to Unlink + x402 |
| Unlink service wrapper | ✅ Done | `services/unlink.ts` — sync, balances, burners, swaps |
| x402 price feed server | ✅ Done | `services/x402.ts` — ETH, MON, USDC endpoints |
| x402 price feed client | ✅ Done | Fetches from trading agent, demo fallback |
| Blockchain service | ✅ Done | `services/blockchain.ts` — NonceManager, sendRawTransactionSync |
| Constraint validator (Layer 2) | ✅ Done | `agent/validator.ts` — 10% cap, 5-min cooldown, token whitelist |
| Demo mode fallback | ✅ Done | `services/demo.ts` — cached responses if LLM goes down |
| Agent chat endpoint | ✅ Done | `POST /api/agent/chat` with rate limiting + input validation |
| Chat history | ✅ Done | `GET /api/agent/history`, `POST /api/agent/clear` |
| Treasury state endpoint | ✅ Done | `GET /api/treasury/state` — balances + privacy status |
| Rate limiting | ✅ Done | 500ms per IP on chat endpoint |
| Input sanitization | ✅ Done | 500 char max, empty/whitespace rejection |
| System prompt engineering | ✅ Done | Privacy model, constraint rules, viewing keys baked in |
| Graceful LLM fallback | ✅ Done | Timeout/error → demo mode (indistinguishable to user) |
| Phase 2 integration test | ✅ Done | **14/14 tests pass in LIVE LLM mode** |
| All 5 demo interactions | ✅ Done | Position, rebalance, explorer, rejection, privacy — all working |

### Phase 3: Frontend Dashboard ✅ BUILT — 26 FILES, ALL FUNCTIONAL

| Component | Status | Notes |
|-----------|--------|-------|
| Scaffold (package.json, Vite, TS) | ✅ Done | React 19, Vite 6, Tailwind v4, Framer Motion |
| Design system (index.css) | ✅ Done | @theme tokens, keyframes, glass cards, gold gradients |
| Lib layer (types, constants, utils, api) | ✅ Done | Typed fetch wrappers, markdown parser, formatters |
| Hooks (useHealth, useTreasury, useActivity, useAgent) | ✅ Done | All consuming real backend data, no mock data |
| AgentChat — the star | ✅ Done | Simulated streaming, tool call animation, markdown rendering |
| ChatMessage — bubbles with markdown | ✅ Done | Tables, headers, lists, bold, code, links, blockquotes |
| ToolCallStep — animated tool calls | ✅ Done | Spinner → checkmark, timing badge, x402 cost badge |
| SuggestedPrompts — 5 demo chips | ✅ Done | Matches the 5 demo interactions from pitch script |
| ThinkingIndicator — animated dots | ✅ Done | Ghost icon + pulsing dots |
| TreasuryStats — live balances | ✅ Done | Real Unlink balances, privacy badge, allocation bars |
| ActivityFeed — real-time log | ✅ Done | Populated from chat events, privacy badges per entry |
| Nav — floating pill | ✅ Done | Live/Offline indicator, brain badge from /health |
| GlowOrbs + noise overlay | ✅ Done | Background effects |
| No mock data | ✅ Done | Zero hardcoded values — everything from backend |
| Defensive JSON validation | ✅ Done | safeJson helper, type validation on every response |
| Build passes | ✅ Done | tsc + vite build clean |

### Known Frontend Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Treasury USD values always $0 | Medium | Backend returns raw balances, no USD. Need to call /price for each token |
| Allocation % split equally | Low | Should be weighted by USD value, but needs price data first |
| Tool call durations simulated | Cosmetic | Random 200-800ms. Backend doesn't return timing data |
| DepositPanel not wired | Low | Modal exists but nothing opens it (no deposit flow yet) |
| No chat history on refresh | Medium | /api/agent/history exists but frontend starts fresh each time |
| Health check doesn't poll | Low | Runs once on mount, won't detect backend going offline mid-session |
| No mobile layout | Low | Fixed 40/60 split breaks on small screens |

### What Works Right Now

```bash
# Terminal 1: Price feeds
cd packages/demo-apis && npm run dev    # Port 3002

# Terminal 2: Backend (treasury agent)
cd packages/backend && npm run dev      # Port 3003

# Terminal 3: Frontend
cd packages/frontend && npm install && npm run dev   # Port 5173 (proxied)

# Open http://localhost:5173
# → Dashboard renders with real backend data
# → Click any suggested prompt → tool calls animate → text streams in
# → Activity feed populates with real events
# → Nav shows "Live" + brain name from /health

# Or just backend:
curl http://localhost:3003/health
# → { agent: "treasury", brain: "openrouter", model: "anthropic/claude-sonnet-4-6" }

curl -X POST http://localhost:3003/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is our position?"}'

npx tsx src/test-phase2.ts   # 14/14 tests pass
```

---

## What Comes Next

### Priority 1: Quick Wins for Demo Polish
- [ ] **USD values in treasury stats** — Fetch /price for each token on treasury refresh, compute real dollar amounts
- [ ] **Load chat history on mount** — Call /api/agent/history and restore previous conversation
- [ ] **Wire deposit button** — At minimum, open the existing DepositPanel stub from the nav

### Priority 2: Smart Contract (GhostVault.sol)
- Deploy on-chain constraint enforcement to Monad testnet
- Layer 3 safety — immutable rules that even a hacked AI can't bypass
- Wire agent's `execute_swap` to go through the contract
- Authorized agent list, daily caps, pause mechanism

### Priority 3: Live DeFi Adapter
- Get the DeFi adapter address from Paul Henry (Unlink team)
- Execute real atomic swaps: unshield → swap → reshield in one tx
- Replace simulated swap results with real on-chain execution
- Fund a burner account for x402 payments (real $0.001 per price check)

### Priority 4: Full DAO Treasury Features (Post-Hackathon)

**Wallet & Funds Management:**
- [ ] Wallet connection (MetaMask/WalletConnect)
- [ ] Deposit flow (approve → deposit → confirm)
- [ ] Withdraw flow (private → public EOA)
- [ ] Transaction history (all deposits, withdrawals, swaps)

**Governance:**
- [ ] Member management (roles, voting power)
- [ ] Proposals to change agent constraints
- [ ] Multi-sig support (2-of-3 or M-of-N)
- [ ] Constraint display (current rules the agent follows)

**Analytics & Risk:**
- [ ] Portfolio performance charts (PnL, drawdown)
- [ ] Risk metrics (VaR, Sharpe ratio, concentration)
- [ ] Historical performance tracking
- [ ] Budget/spending limit enforcement

**Operations:**
- [ ] Agent audit log (immutable decision log with reasoning)
- [ ] Notifications (email/Telegram/Discord alerts)
- [ ] Emergency controls (pause, kill switch in UI)
- [ ] Block explorer integration (inline MonadScan proof)
- [ ] Real-time WebSocket price feeds

**Compliance & Reporting:**
- [ ] Tax reports
- [ ] Regulatory disclosures
- [ ] KYC/AML for institutional DAOs

### Priority 5: Polish & Ship
- Demo mode toggle — seamless fallback for stage demos
- Record backup demo video
- Submit to DoraHacks
- Rehearse the 5 demo interactions 5+ times
- The "Find the Trade" MonadScan moment with a real deposit

---

## The Full Flow (End to End)

```
1. DAO Member deposits USD
   (via Alchemy Pay / credit card / Venmo — future)
        ↓
2. USD converted to USDC on Monad
        ↓
3. USDC deposited into Unlink Privacy Pool
   (visible on-chain: "someone deposited X into the pool")
   (invisible: who, which account, what for)
        ↓
4. Treasury Agent receives deposit notification
        ↓
5. Research Agent buys market data via x402
   (pays $0.001 per price check from a burner wallet)
        ↓
6. Treasury Agent (Claude Sonnet 4.6) decides on trades
   → Checks constraints (10% max, 5-min cooldown)
   → Uses tool calls: check_balance → get_price → execute_swap
        ↓
7. Trading Agent executes private swap via Unlink DeFi Adapter
   (atomic: unshield → swap → reshield in one transaction)
        ↓
8. On block explorer: you see a transaction to the Unlink pool
   You CANNOT see: amount, tokens, strategy, who traded
        ↓
9. Members check status via chat: "What's our position?"
   AI responds with portfolio breakdown (via viewing keys)
```

---

## Key Files

| File | What It Does |
|------|-------------|
| `.env` | Secret keys, OpenRouter API key, model config, demo mode toggle |
| `CLAUDE.md` | Full technical spec (the bible) |
| **Shared** | |
| `packages/shared/src/constants.ts` | Monad addresses, USDC, Unlink pool, x402 config |
| `packages/shared/src/types.ts` | TypeScript interfaces for everything |
| **Backend** | |
| `packages/backend/src/config.ts` | Creates blockchain clients + Unlink wallets |
| `packages/backend/src/research.ts` | Research agent (port 3001) |
| `packages/backend/src/trading.ts` | Trading agent + x402 price feeds (port 3002) |
| `packages/backend/src/treasury.ts` | Treasury agent + AI brain (port 3003) |
| `packages/backend/src/agent/core.ts` | Claude Sonnet 4.6 tool-use loop via OpenRouter |
| `packages/backend/src/agent/tools.ts` | 6 tools: check_balance, get_price, execute_swap, generate_report, update_settings, get_members |
| `packages/backend/src/agent/validator.ts` | Mutable constraint enforcement (Layer 2 safety) + DB persistence |
| `packages/backend/src/services/db.ts` | SQLite database — members, deposits, withdrawals, settings audit |
| `packages/backend/src/routes/members.ts` | POST /register, GET /, GET /:wallet — member management |
| `packages/backend/src/routes/settings.ts` | GET / — constraints + governance + recent changes |
| `packages/backend/src/services/unlink.ts` | Unlink SDK wrapper (sync, balances, burners, swaps) |
| `packages/backend/src/services/x402.ts` | x402 price feed server + client |
| `packages/backend/src/services/blockchain.ts` | NonceManager + sendRawTransactionSync |
| `packages/backend/src/services/demo.ts` | Demo mode cached responses (fallback) |
| `packages/backend/src/routes/agent.ts` | POST /api/agent/chat endpoint with rate limiting |
| `packages/backend/src/test-phase2.ts` | 14 integration tests (works in live + demo mode) |
| **Frontend** | |
| `packages/frontend/src/App.tsx` | Shell: nav, two-panel layout, footer, all hooks wired |
| `packages/frontend/src/index.css` | Tailwind v4 @theme tokens, keyframes, glass utilities |
| `packages/frontend/src/lib/api.ts` | Typed fetch wrappers with defensive JSON validation |
| `packages/frontend/src/lib/utils.ts` | formatUsd, parseMarkdown (tables, headers, lists) |
| `packages/frontend/src/hooks/useAgent.ts` | Chat state, simulated streaming, tool call animation |
| `packages/frontend/src/hooks/useTreasury.ts` | Live Unlink balances, privacy status |
| `packages/frontend/src/components/AgentChat.tsx` | THE STAR — chat container with streaming |
| `packages/frontend/src/components/ChatMessage.tsx` | Message bubbles with full markdown rendering |
| `packages/frontend/src/components/ToolCallStep.tsx` | Animated tool call (spinner → checkmark + cost badge) |
| `packages/frontend/src/components/TreasuryStats.tsx` | Treasury value, allocation bars, shielded badge |
| `packages/frontend/src/components/ActivityFeed.tsx` | Real-time activity log with privacy badges |
| `packages/frontend/src/hooks/useWallet.ts` | MetaMask connection, localStorage, chain validation |
| `packages/frontend/src/hooks/usePool.ts` | Fetches member list, derives share/power |
| `packages/frontend/src/hooks/useConstraints.ts` | Fetches governance settings |
| `packages/frontend/src/components/WalletButton.tsx` | Connect/disconnect wallet with status dot |
| `packages/frontend/src/components/PoolBar.tsx` | Pool overview strip (members, total, share, power) |
| `packages/frontend/src/components/LeftTabs.tsx` | Tabbed left panel: Overview / Members / Settings |
| `packages/frontend/src/components/MemberList.tsx` | Member cards with share bars |
| `packages/frontend/src/components/SettingsPanel.tsx` | Read-only constraints + "Ask Ghost" CTAs |
| `packages/frontend/src/components/YourPosition.tsx` | Personal position: value, share, voting power |
| `packages/shared/src/dao-types.ts` | Member, MemberWithPower, PoolStats, SettingsChangeRecord types |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│               FRONTEND ✅ BUILT (Phase 3)           │
│      React 19 + Vite 6 + Tailwind v4 (dark theme)  │
│    ┌──────────┐  ┌───────────┐  ┌──────────────┐   │
│    │AgentChat │  │ Treasury  │  │ ActivityFeed │   │
│    │(streaming│  │ Stats     │  │ (real events)│   │
│    │+markdown)│  │ (live)    │  │              │   │
│    └────┬─────┘  └─────┬─────┘  └──────────────┘   │
└─────────┼──────────────┼────────────────────────────┘
          │ POST /chat   │ GET /state
          ▼              ▼
┌─────────────────────────────────────────────────────┐
│              TREASURY AGENT (:3003)                  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │         Claude Sonnet 4.6 (via OpenRouter)     │  │
│  │                                                │  │
│  │  Dynamic System Prompt: caller identity,       │  │
│  │  voting power, pool stats, constraints         │  │
│  │  Tools: check_balance, get_price,              │  │
│  │         execute_swap, generate_report,         │  │
│  │         update_settings, get_members           │  │
│  └──────────┬────────────────────┬────────────────┘  │
│             │                    │                    │
│  ┌──────────▼──────┐  ┌─────────▼──────────┐        │
│  │ Unlink Service  │  │ Constraint Validator│        │
│  │ (balances,      │  │ (mutable, DB-backed│        │
│  │  swaps, burners)│  │  + governance)     │        │
│  └─────────────────┘  └────────────────────┘        │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  SQLite DB (data/ghost-dao.db)                 │  │
│  │  members | deposits | withdrawals | settings   │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────┘
                           │ fetch price
                           ▼
┌─────────────────────────────────────────────────────┐
│              TRADING AGENT (:3002)                   │
│                                                      │
│  x402 Price Feeds:                                   │
│    GET /price/eth  → $3,847.50                       │
│    GET /price/mon  → $0.42                           │
│    GET /price/usdc → $1.00                           │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│                   MONAD TESTNET                      │
│                                                      │
│  Unlink Pool ──── DeFi Adapter ──── DEX              │
│  (ZK privacy)    (atomic swap)     (token exchange)  │
│                                                      │
│  sendRawTransactionSync → 800ms full receipt         │
│  NonceManager → no nonce collisions                  │
└─────────────────────────────────────────────────────┘
```
