# Ghost Treasury — How Everything Connects (Personal Reference)

## The Big Picture

You have 4 running processes + 1 blockchain. Here's how they talk to each other:

```
YOU (Browser)
    |
    | http://localhost:5173
    |
    v
+------------------+        +------------------+        +------------------+
|                  |  REST  |                  |  x402   |                  |
|    FRONTEND      |------->|    BACKEND       |-------->|    DEMO APIs     |
|    (React)       |<-------|    (Node.js)     |<--------|    (Express)     |
|    :5173         |  SSE   |    :3001         |  JSON   |    :3002         |
|                  |        |                  |         |                  |
|  What it does:   |        |  What it does:   |        |  What it does:   |
|  - Shows UI      |        |  - Runs Claude   |        |  - Serves prices |
|  - Deposit form  |        |  - Calls Unlink  |        |  - Charges $0.001|
|  - Chat window   |        |  - Calls x402    |        |    via x402      |
|  - Activity log  |        |  - Validates     |        |  - Settles on    |
|  - Balance chart |        |    constraints   |        |    Monad via     |
|                  |        |  - Streams events|        |    facilitator   |
+------------------+        +--------+---------+        +------------------+
                                     |
                    +----------------+----------------+
                    |                                  |
                    v                                  v
          +-----------------+              +---------------------+
          |  UNLINK SDK     |              |  MONAD TESTNET      |
          |  (@unlink/node) |              |  (Chain 10143)      |
          |                 |              |                     |
          |  Talks to:      |              |  Contracts:         |
          |  - Pool contract|  on-chain    |  - Unlink Pool      |
          |  - Gateway API  +------------->|  - GhostVault.sol   |
          |  - Local wallet |              |  - Uniswap Router   |
          |    (SQLite)     |              |  - USDC token       |
          +-----------------+              +---------------------+
```

---

## Every Operation, Step by Step

### OPERATION 1: Member Deposits USDC

```
WHO DOES WHAT:

1. You click "Deposit 100 USDC" in the React UI
   |
2. Frontend calls MetaMask: "Approve USDC to Unlink Pool"
   |
3. MetaMask pops up → you confirm
   |
4. Frontend calls Unlink React SDK: deposit(100 USDC)
   |
5. Unlink SDK generates a ZK proof:
   - Creates a "note" = {value: 100, commitment: hash(...), nullifier: hash(...)}
   - Proof says: "I'm depositing 100 USDC and here's a valid commitment"
   |
6. Unlink SDK sends proof + deposit tx to Gateway (api.unlink.xyz)
   |
7. Gateway relays tx to Monad testnet
   |
8. Unlink Pool contract on Monad:
   - Takes 100 USDC from your wallet
   - Stores commitment in Merkle tree
   - Emits Deposit event (PUBLIC: who, how much)
   |
9. Your wallet now has a private "note" stored in local SQLite
   - Only you (with viewing key) can see it
   - The pool just shows "someone deposited 100 USDC"

WHAT'S PUBLIC:     Your wallet address, 100 USDC, deposit to pool
WHAT'S PRIVATE:    The note's owner, the commitment details
```

### OPERATION 2: Agent Checks Treasury Balance

```
WHO DOES WHAT:

1. You type "What's our position?" in AgentChat
   |
2. Frontend POSTs to Backend: /api/agent/chat { message: "What's our position?" }
   |
3. Backend sends to Claude API:
   - System prompt: "You are Ghost, a private treasury manager..."
   - User message: "What's our position?"
   - Tools: [check_balance, get_price, execute_swap, generate_report]
   |
4. Claude responds: "I'll check the balance"
   - stop_reason: "tool_use"
   - tool: "check_balance"
   |
5. Backend executes tool:
   - Calls unlink.getBalances() using the VIEWING KEY
   - Viewing key decrypts notes in the local SQLite DB
   - Returns: { USDC: 40825, ETH: 3.12, MON: 1200 }
   |
6. Backend sends tool result back to Claude:
   - tool_result: { USDC: 40825, ETH: 3.12, MON: 1200 }
   |
7. Claude generates final response:
   "Treasury holds $52,340 across 3 assets..."
   |
8. Backend streams response to Frontend via SSE (Server-Sent Events)
   |
9. Frontend renders the response in the chat bubble

NO ON-CHAIN ACTIVITY. This is a local read using the viewing key.
```

### OPERATION 3: Agent Buys Price Data via x402

```
WHO DOES WHAT:

1. Claude decides: "I need ETH price. I'll use get_price tool."
   |
2. Backend executes get_price("ETH"):
   |
3. Backend calls Demo API with x402 client:
   fetch("http://localhost:3002/price/eth")
   |
4. Demo API responds: 402 Payment Required
   Headers include: X-402-Payment-Required, price: $0.001, network: eip155:10143
   |
5. x402 client (in Backend) sees 402, auto-handles payment:
   a. Creates a signed authorization (EIP-3009 transferWithAuthorization)
   b. Signs with BURNER account private key (NOT the treasury key)
   c. Sends signed auth to x402 facilitator (molandak.org)
   |
6. x402 Facilitator:
   a. Receives the signed authorization
   b. Calls USDC.transferWithAuthorization() on Monad
   c. Transfers $0.001 USDC from burner → Demo API's payTo address
   d. Returns settlement proof
   |
7. x402 client retries the original request with payment proof
   |
8. Demo API verifies payment, responds:
   { asset: "ETH", price: 3847.22, timestamp: "..." }
   |
9. Backend returns price to Claude as tool_result

WHAT'S PUBLIC:     Burner address paid $0.001 to some address (on Monad)
WHAT'S PRIVATE:    Burner is NOT linked to treasury. No one knows WHO asked.
```

### OPERATION 4: Agent Executes Private Swap (THE BIG ONE)

```
WHO DOES WHAT:

1. Claude decides: "Buy 5000 USDC worth of ETH"
   Uses tool: execute_swap(from: USDC, to: ETH, amount: 5000)
   |
2. Backend LAYER 1 — Claude Self-Check:
   Claude already checked: "5000 = 10% of 50000, within 10% limit"
   |
3. Backend LAYER 2 — App Validator:
   validator.check({
     action: "swap",
     amount: 5000,
     balance: 50000,
     maxPct: 10,        // max 10% per trade
     cooldown: passed,
     tokenAllowed: true
   })
   → PASSED
   |
4. Backend calls Unlink SDK: unlink.interact({...})
   |
5. Unlink SDK builds the atomic transaction:
   |
   STEP A: Unshield
   - Selects note(s) worth >= 5000 USDC from local wallet
   - Generates ZK proof: "I own this note and I'm consuming it"
   - Nullifier is computed (marks note as spent)
   |
   STEP B: DeFi Calls (encoded in the transaction)
   - Call 1: USDC.approve(UniswapRouter, 5000)
   - Call 2: UniswapRouter.swapExactTokensForTokens(
       5000 USDC,
       minETH (with slippage),
       [USDC, WETH],
       adapterAddress,    // NOT your address — the adapter catches it
       deadline
     )
   |
   STEP C: Reshield
   - Takes the ETH received from swap
   - Creates NEW note(s) for the ETH
   - New commitment added to Merkle tree
   |
6. Unlink SDK sends the whole package to Gateway
   |
7. Gateway relays to Monad as ONE TRANSACTION:
   Pool.interact(proof, nullifier, calls, reshieldData)
   |
8. Monad executes in ONE ATOMIC TX (400ms):
   - Verifies ZK proof ✓
   - Records nullifier (note is now spent) ✓
   - Unshields 5000 USDC to adapter ✓
   - Adapter approves router ✓
   - Router swaps USDC → ETH ✓
   - Adapter sends ETH back to pool ✓
   - Pool creates new shielded note for ETH ✓
   |
   If ANY step fails → EVERYTHING reverts. Funds stay safe.
   |
9. Backend gets receipt via eth_sendRawTransactionSync (800ms)
   |
10. Backend returns tool_result to Claude:
    { success: true, received: "1.298 ETH", txHash: "0xabc..." }
    |
11. Claude responds: "Trade complete. Acquired 1.298 ETH. Fully private."

WHAT THE BLOCK EXPLORER SHOWS:
  tx: 0xabc123...
  from: Unlink Gateway Relayer     ← NOT your address
  to: Unlink Pool (0x0813...)      ← just the pool contract
  method: interact()               ← generic method name
  gas used: ~500K

  WHO traded?    Unknown
  HOW MUCH?      Unknown
  WHAT FOR?      Unknown
  WHICH MEMBER?  Unknown
```

### OPERATION 5: Agent Rejects Bad Trade

```
WHO DOES WHAT:

1. You type: "Swap 100% of treasury to DOGE"
   |
2. Claude receives the request
   |
3. Claude checks constraints in system prompt:
   "100% > 10% max. I must reject."
   |
4. Claude responds (NO tool call):
   "Rejected. Your rules cap trades at 10% of treasury.
    Even if I wanted to execute this, the on-chain
    constraint contract would block it."
   |
5. Nothing happens on-chain. No tool executed. No transaction.

EVEN IF CLAUDE SOMEHOW CALLED execute_swap:
  → Layer 2 (App Validator) would reject: 100% > 10%
  → Layer 3 (GhostVault.sol) would revert: epochSpent + amount > dailyCap

THREE INDEPENDENT LAYERS. All must pass.
```

### OPERATION 6: Member Withdraws

```
WHO DOES WHAT:

1. Member clicks "Withdraw 500 USDC" in React UI
   |
2. Frontend calls Unlink React SDK: withdraw(500 USDC, recipientAddress)
   |
3. Unlink SDK:
   - Selects note(s) worth >= 500 USDC
   - Generates ZK proof: "I own these notes"
   - Computes nullifiers
   - If change needed: creates new note for remainder
   |
4. Gateway relays withdrawal tx to Monad
   |
5. Unlink Pool on Monad:
   - Verifies proof ✓
   - Records nullifiers ✓
   - Sends 500 USDC to recipient address
   |
6. Member's wallet receives 500 USDC

WHAT'S PUBLIC:     500 USDC sent TO recipient address
WHAT'S PRIVATE:    WHO in the pool it came from
```

---

## The Data Flow in One Picture

```
+-------+     +----------+     +---------+     +----------+     +---------+
| USER  |     | FRONTEND |     | BACKEND |     | CLAUDE   |     | UNLINK  |
| (you) |     | (React)  |     | (Express)|    | (API)    |     | (SDK)   |
+---+---+     +----+-----+     +----+----+     +----+-----+     +----+----+
    |              |                |                |                |
    |  type msg    |                |                |                |
    |------------->|  POST /chat    |                |                |
    |              |--------------->|  messages.create               |
    |              |                |--------------->|                |
    |              |                |                |                |
    |              |                |  tool_use:     |                |
    |              |                |  check_balance |                |
    |              |                |<---------------|                |
    |              |                |                |                |
    |              |                |  getBalances() |                |
    |              |                |------------------------------->|
    |              |                |  {USDC: 40825} |                |
    |              |                |<-------------------------------|
    |              |                |                |                |
    |              |                |  tool_result   |                |
    |              |                |--------------->|                |
    |              |                |                |                |
    |              |                |  tool_use:     |                |
    |              |                |  get_price     |                |
    |              |                |<---------------|                |
    |              |                |                |                |
    |              |                |  x402 fetch -------> DEMO API (:3002)
    |              |                |     402 <------------ $0.001 required
    |              |                |  pay via burner ----> FACILITATOR
    |              |                |     settled <-------- on Monad
    |              |                |  retry + proof -----> DEMO API
    |              |                |     ETH=$3847 <------ price data
    |              |                |                |                |
    |              |                |  tool_result   |                |
    |              |                |--------------->|                |
    |              |                |                |                |
    |              |                |  tool_use:     |                |
    |              |                |  execute_swap  |                |
    |              |                |<---------------|                |
    |              |                |                |                |
    |              |                |  VALIDATE      |                |
    |              |                |  (app layer)   |                |
    |              |                |                |                |
    |              |                |  interact()    |                |
    |              |                |------------------------------->|
    |              |                |                |    ZK proof    |
    |              |                |                |    + nullifier |
    |              |                |                |    + DeFi calls|
    |              |                |                |       |        |
    |              |                |                |       v        |
    |              |                |                |   GATEWAY ---> MONAD
    |              |                |                |                |
    |              |                |  receipt (800ms)|               |
    |              |                |<-------------------------------|
    |              |                |                |                |
    |              |                |  tool_result   |                |
    |              |                |--------------->|                |
    |              |                |                |                |
    |              |                |  final text    |                |
    |              |                |<---------------|                |
    |              |  SSE stream    |                |                |
    |              |<---------------|                |                |
    |  see response|                |                |                |
    |<-------------|                |                |                |
```

---

## What Each Package Does (Plain English)

### `packages/shared/`
Types and constants. Every other package imports from here. Token addresses, chain IDs, TypeScript interfaces. Touched rarely.

### `packages/backend/`
The brain. Express server on port 3001. Has three jobs:
1. **Agent loop** — sends messages to Claude, executes tool calls, streams responses
2. **Unlink service** — wraps the SDK for deposits, balances, swaps, withdrawals
3. **x402 service** — wraps the x402 client for paying for price data

Routes:
- `POST /api/agent/chat` — send a message, get SSE stream back
- `GET /api/treasury/state` — current balances + allocation
- `GET /api/activity` — SSE stream of agent actions

### `packages/frontend/`
The face. Vite + React on port 5173. Dark theme. Components:
- **Dashboard** — treasury overview, allocation chart
- **AgentChat** — the core demo screen, chat with the agent
- **DepositPanel** — deposit USDC/MON into privacy pool
- **ActivityFeed** — log of everything the agent did
- **TreasuryStats** — allocation pie chart, 24h change

### `packages/demo-apis/`
The mock data source. Express on port 3002. Serves price feeds behind x402 paywalls. The agent pays $0.001 per request. This demonstrates x402 integration without needing a real data provider.

### `packages/contracts/`
GhostVault.sol — the on-chain safety net. Enforces:
- Only authorized agent can execute trades
- Daily spending cap (e.g., max 25% of treasury per day)
- Emergency pause by any member

---

## The Key Insight for Demo

The entire demo is a CHAT CONVERSATION. You talk to the agent, it responds, it acts. Every integration (Claude, Unlink, x402, Monad) fires through that one chat interface. That's why the Agent Chat component is "The One Thing."

When a judge types a question, the agent:
1. Reasons about it (Claude)
2. Checks the treasury (Unlink viewing key)
3. Pays for market data (x402 burner)
4. Validates constraints (app layer)
5. Executes privately (Unlink DeFi adapter)
6. Confirms in 800ms (Monad sendRawTransactionSync)
7. Responds in plain English

All in one chat bubble. That's the product.
