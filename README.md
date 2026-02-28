# Ghost Treasury

> Private AI-managed DAO treasury on Monad + Unlink

An AI agent that manages a DAO's money privately. Members deposit openly, the agent trades secretly, and no one on-chain can see the strategy.

Built for the **Ship Private. Ship Fast.** hackathon by Unlink x Monad (Feb 27 - Mar 1, 2026).

## What It Does

1. Members deposit funds into Unlink's ZK privacy pool
2. A Claude-powered AI agent manages the treasury within member-defined constraints
3. The agent acquires market data via x402 micropayments using burner accounts
4. All trades execute privately through Unlink's DeFi adapter
5. Three safety layers prevent the AI from going rogue

## Tech Stack

- **Privacy**: Unlink SDK (ZK proofs, shielded pool, viewing keys)
- **Chain**: Monad Testnet (10K TPS, 400ms blocks, 800ms finality)
- **AI**: Claude API (tool-use agent loop)
- **Payments**: x402 protocol (HTTP-native micropayments)
- **Frontend**: React + Vite + Tailwind
- **Backend**: Node.js + Express
- **Contracts**: Solidity + Foundry

## Quick Start

```bash
# Install
npm install

# Set up environment
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, PRIVATE_KEY, AGENT_PRIVATE_KEY

# Run all services
npm run dev
```

## Architecture

```
Frontend (:5173) <---> Backend (:3001) <---> Demo APIs (:3002)
                           |
                    Monad Testnet (10143)
                    Unlink Pool + DeFi
                    x402 Facilitator
```

## Tracks

- General
- Treasury
- x402 Agents
- Best Use of Unlink SDK
