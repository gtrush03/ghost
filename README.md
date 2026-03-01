# Ghost Treasury

> Private AI-managed DAO treasury on Monad + Unlink

An AI agent that manages a DAO's money privately. Members deposit openly, the agent trades secretly, and no one on-chain can see the strategy.

Built at the **Ship Private. Ship Fast.** hackathon by Unlink x Monad (Feb 27 - Mar 1, 2026). Now evolving into a real multi-user DAO.

## What It Does

1. Members connect their wallet and deposit funds into Unlink's ZK privacy pool
2. A Claude-powered AI agent (via OpenRouter) manages the treasury within governance constraints
3. The agent acquires market data via x402 micropayments using burner accounts
4. All trades execute privately through Unlink's DeFi adapter (atomic unshield-swap-reshield)
5. Three safety layers prevent the AI from going rogue (self-check, app validator, on-chain contract)
6. Members control settings by talking to the agent — voting power is deposit-weighted

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Privacy | Unlink SDK (ZK proofs, shielded pool, viewing keys) |
| Chain | Monad Testnet (10K TPS, 400ms blocks, 800ms finality) |
| AI | Claude Sonnet via OpenRouter (tool-use agent loop, 6 tools) |
| Payments | x402 protocol (HTTP-native micropayments from burner accounts) |
| Frontend | React 19 + Vite 6 + Tailwind v4 + Framer Motion |
| Backend | Node.js + Express + SQLite (better-sqlite3) |
| Contracts | Solidity (GhostVault — on-chain constraint enforcement) |

## Quick Start

### Prerequisites

- Node.js 20+
- An OpenRouter API key ([openrouter.ai/keys](https://openrouter.ai/keys))
- A private key with MON on Monad Testnet ([faucet.monad.xyz](https://faucet.monad.xyz))

### Setup

```bash
# Clone
git clone https://github.com/gtrush03/ghost.git
cd ghost

# Install all packages
npm install

# Configure environment
cp .env.example .env
# Edit .env — fill in your keys (see Environment Variables below)
```

### Run

You need 3 terminals:

```bash
# Terminal 1: Trading agent + price feeds (port 3002)
cd packages/backend && npx tsx src/trading.ts

# Terminal 2: Treasury agent + AI brain (port 3003)
cd packages/backend && npx tsx src/treasury.ts

# Terminal 3: Frontend (port 5173, proxied to backend)
cd packages/frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Demo Mode

If you don't have API keys, set `DEMO_MODE=true` in `.env` for cached responses (no LLM needed). The app also auto-falls back to demo mode if the LLM times out.

## Environment Variables

Create a `.env` file in the project root:

```env
# Agent Private Keys (3 separate keys for separation of concerns)
# Generate with: openssl rand -hex 32 (prefix with 0x)
RESEARCH_AGENT_KEY=0x...
TRADING_AGENT_KEY=0x...
TREASURY_AGENT_KEY=0x...

# Monad Testnet
MONAD_RPC_URL=https://testnet-rpc.monad.xyz

# Unlink SDK
UNLINK_CHAIN=monad-testnet

# x402 Facilitator (Monad)
X402_FACILITATOR_URL=https://x402-facilitator.molandak.org

# OpenRouter (LLM backend — Claude Sonnet)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4-6

# Price feed URL (trading agent)
PRICE_FEED_URL=http://localhost:3002

# Deployer key (for contract deployment — can reuse TREASURY_AGENT_KEY)
PRIVATE_KEY=0x...
AGENT_ADDRESS=0x...   # derived: cast wallet address $PRIVATE_KEY

# GhostVault contract (set after deploying)
GHOST_VAULT_ADDRESS=0x...

# Demo mode (true = cached responses, no LLM needed)
DEMO_MODE=false
```

## Project Structure

```
ghost-treasury/
├── .env.example              # Environment template
├── CLAUDE.md                 # Full technical spec (AI context)
├── GHOST-EXPLAINED.md        # Everything explained in plain English
├── packages/
│   ├── shared/src/
│   │   ├── types.ts          # Core interfaces (AgentEvent, TreasuryState, etc.)
│   │   ├── constants.ts      # Monad addresses, token contracts, defaults
│   │   └── dao-types.ts      # DAO types (Member, PoolStats, etc.)
│   ├── backend/src/
│   │   ├── treasury.ts       # Main entry point (port 3003)
│   │   ├── trading.ts        # Price feed server (port 3002)
│   │   ├── agent/
│   │   │   ├── core.ts       # Claude tool-use loop (dynamic system prompt)
│   │   │   ├── tools.ts      # 6 tools: balance, price, swap, report, settings, members
│   │   │   └── validator.ts  # Mutable constraint enforcement (Layer 2)
│   │   ├── routes/
│   │   │   ├── agent.ts      # POST /api/agent/chat (with wallet context)
│   │   │   ├── members.ts    # POST /register, GET /, GET /:wallet
│   │   │   └── settings.ts   # GET /api/treasury/settings
│   │   └── services/
│   │       ├── db.ts         # SQLite database (members, deposits, governance)
│   │       ├── unlink.ts     # Unlink SDK wrapper
│   │       ├── x402.ts       # x402 micropayment client
│   │       ├── blockchain.ts # sendRawTransactionSync + NonceManager
│   │       └── demo.ts       # Demo mode cached responses
│   └── frontend/src/
│       ├── App.tsx           # Shell with wallet, pool, settings hooks
│       ├── hooks/
│       │   ├── useWallet.ts  # MetaMask connection (EIP-1193)
│       │   ├── usePool.ts    # Pool members + shares
│       │   ├── useConstraints.ts  # Governance settings
│       │   ├── useAgent.ts   # Chat state + streaming
│       │   └── useTreasury.ts # Live balances
│       └── components/
│           ├── AgentChat.tsx     # THE STAR — chat with streaming + tools
│           ├── PoolBar.tsx       # Pool overview (members, total, share)
│           ├── LeftTabs.tsx      # Overview / Members / Settings tabs
│           ├── WalletButton.tsx  # Connect/disconnect MetaMask
│           ├── MemberList.tsx    # Member cards with share bars
│           ├── SettingsPanel.tsx # Constraints + "Ask Ghost" CTAs
│           └── YourPosition.tsx  # Personal stats
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Agent health + status |
| GET | `/api/treasury/state` | Current balances (via Unlink pool) |
| POST | `/api/agent/chat` | Send message to AI agent (`{ message, wallet? }`) |
| GET | `/api/agent/history` | Chat history |
| POST | `/api/members/register` | Register wallet as member (`{ wallet }`) |
| GET | `/api/members` | List all members with shares + voting power |
| GET | `/api/members/:wallet` | Specific member + deposit history |
| GET | `/api/treasury/settings` | Current constraints + governance info |
| POST | `/api/treasury/deposit` | Generate deposit calldata |
| POST | `/api/treasury/deposit/confirm` | Confirm on-chain deposit |

## Agent Tools

| Tool | Description |
|------|-------------|
| `check_balance` | Query Unlink pool balances |
| `get_price` | Fetch asset price via x402 micropayment ($0.001) |
| `execute_swap` | Atomic private swap (unshield-swap-reshield) |
| `generate_report` | Treasury report with pool stats |
| `update_settings` | Change governance settings (requires 51% voting power) |
| `get_members` | List all DAO members with shares |

## Safety Architecture

```
User Request → Claude AI proposes action
                    ↓
            [Layer 1: AI Self-Check]
            "Does this violate constraints?"
                    ↓
            [Layer 2: App Validator]
            validateTrade() — max trade %, cooldown, token whitelist
                    ↓
            [Layer 3: GhostVault.sol]
            On-chain contract enforces immutable rules
                    ↓
            EXECUTE or REJECT
```

## Governance

- **Voting power** = your net deposits (USD) / total pool value (USD)
- **51% required** to change settings (maxTradePct, cooldownMinutes, paused)
- Settings changed by talking to the agent, not clicking buttons
- All changes logged in SQLite audit table (approved + rejected attempts)
- Constraints persist across server restarts

## Contributing

```bash
# Type check backend
cd packages/backend && npx tsc --noEmit

# Type check frontend
cd packages/frontend && npx tsc --noEmit

# Run backend tests
cd packages/backend && npx tsx src/test-phase2.ts
```

## License

MIT
