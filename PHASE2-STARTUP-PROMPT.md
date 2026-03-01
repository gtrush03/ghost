# Ghost Treasury — Phase 2: Agent Brains (Startup Prompt)

## Context
You're continuing work on Ghost Treasury, a hackathon project for the Unlink x Monad hackathon (NYC, Feb 27 – Mar 1, 2026). **Phase 1 is 100% complete and verified.** All 3 agent wallets are funded with testnet MON. Now we need Phase 2: Agent Brains.

## What's Done (Phase 1 — DO NOT REBUILD)
- Monorepo at `/Users/gtrush/Downloads/ghost-treasury/`
- 3 agents: Research (port 3001), Trading (port 3002), Treasury (port 3003)
- All boot, health endpoints work, Unlink wallets initialized
- Wallets funded: Treasury 40 MON, Research 30 MON, Trading 30 MON
- 13/13 validation tests pass (`npx tsx src/test-phase1.ts`)

## What We're Building Now (Phase 2)
Instead of using `@anthropic-ai/sdk` directly (as CLAUDE.md originally specified), we're using **OpenClaw + OpenRouter** for the agent brains. This gives us a full agent runtime with skills, sessions, and multi-model support.

### Phase 2 Tasks:
1. **Set up OpenClaw** with OpenRouter as LLM backend in the ghost-treasury project
2. **Create Treasury Agent Skill** (SKILL.md) — the AI brain that manages the private treasury
3. **Build x402 price feed API** — Express server with x402 payment middleware serving ETH/USDC/MON prices
4. **Build Unlink service wrapper** — `services/unlink.ts` for deposits, withdrawals, swaps, balance checks, burner accounts
5. **Build constraint validator** — `agent/validator.ts` enforcing trade limits, allowed tokens, cooldown
6. **Wire agent chat endpoint** — POST /api/agent/chat connecting OpenClaw to frontend
7. **Integration test** — end-to-end: user message → agent thinks → calls tools → returns response

## FILES TO READ FIRST

### Ghost Treasury (the project):
- `/Users/gtrush/Downloads/ghost-treasury/CLAUDE.md` — FULL project spec, architecture, APIs, demo plan
- `/Users/gtrush/Downloads/ghost-treasury/packages/backend/src/config.ts` — Monad chain def, viem clients, Unlink wallet factory
- `/Users/gtrush/Downloads/ghost-treasury/packages/backend/src/treasury.ts` — Treasury agent stub (extend this)
- `/Users/gtrush/Downloads/ghost-treasury/packages/backend/src/research.ts` — Research agent stub
- `/Users/gtrush/Downloads/ghost-treasury/packages/backend/src/trading.ts` — Trading agent stub
- `/Users/gtrush/Downloads/ghost-treasury/packages/shared/src/types.ts` — All TypeScript interfaces
- `/Users/gtrush/Downloads/ghost-treasury/packages/shared/src/constants.ts` — Chain addresses, USDC, pool addresses
- `/Users/gtrush/Downloads/ghost-treasury/packages/backend/package.json` — Current dependencies
- `/Users/gtrush/Downloads/ghost-treasury/.env` — Environment variables (3 agent keys + config)

### Project Skills (specialized knowledge):
- `/Users/gtrush/Downloads/ghost-treasury/.claude/skills/unlink-sdk.md` — Complete Unlink API reference
- `/Users/gtrush/Downloads/ghost-treasury/.claude/skills/x402.md` — x402 payment protocol reference
- `/Users/gtrush/Downloads/ghost-treasury/.claude/skills/monad.md` — Monad blockchain reference

### OpenClaw Reference (how to use OpenClaw):
- `/Users/gtrush/Downloads/event-agent-openclaw/services/browser-worker/src/index.ts` — Shows how to call OpenClaw `/v1/responses` from Express
- `/Users/gtrush/Downloads/event-agent-openclaw/docs/openclaw-contract.md` — OpenClaw JSON output contract
- `/Users/gtrush/Downloads/event-agent-openclaw/docs/architecture.md` — Multi-service architecture
- `/Users/gtrush/Downloads/event-agent-openclaw/docs/api.md` — API endpoints
- `/Users/gtrush/Downloads/event-agent-openclaw/README.md` — Project overview

### OpenClaw Hack Sprint (additional context):
- `/Users/gtrush/Downloads/NYC/clawhack/CLAUDE.md` — Implementation notes
- `/Users/gtrush/Downloads/NYC/clawhack/BATTLE-PLAN.md` — Sprint tactical plan
- `/Users/gtrush/Downloads/NYC/clawhack/FINAL-CONCEPT.md` — Sprint outcome

### OpenClaw Fork:
- `/Users/gtrush/Downloads/synthos/openclaw-fork` — Full OpenClaw framework fork

## Key Technical Facts
- **OpenClaw** = open-source AI agent platform, TypeScript ESM, Node 22+
- **OpenRouter** = LLM router giving access to 100+ models with one API key
- OpenClaw gateway: `ws://127.0.0.1:18789`, API: `POST /v1/responses`
- OpenRouter model format: `openrouter/anthropic/claude-sonnet-4-5`
- Monad: use `eth_sendRawTransactionSync` for instant receipts, local nonce manager required
- Monad: gas charged on LIMIT not USED — set tight limits
- Unlink SDK: `initUnlink()` → `sdk.accounts.getActive()` for address (NOT `.getAddress()`)
- Unlink SDK: all packages `@canary` channel
- x402: must call `evmScheme.registerMoneyParser()` for Monad (`eip155:10143`), USDC domain name is "USDC"
- dotenv: `.env` at repo root, resolve 3 dirs up from `packages/backend/src/`

## The 5 Demo Interactions (What We're Building Toward)
1. "What's our position?" → Agent checks Unlink balances
2. "Rebalance to 60/40 ETH/USDC" → Agent buys price via x402, checks constraints, executes private swap
3. "Show me on block explorer" → Transaction visible but WHO/WHAT/HOW MUCH invisible
4. "Swap 100% to memecoin" → Agent REJECTS (constraint violation)
5. "Who can see our strategy?" → Agent explains privacy model

## Start Here
1. Read CLAUDE.md for the full spec
2. Read the OpenClaw reference files to understand how to call OpenClaw programmatically
3. Check if OpenClaw is installed (`which openclaw` or `npm list -g openclaw`)
4. Plan the integration: OpenClaw as the AI brain, our Express agents as the tool providers
5. Start building!
