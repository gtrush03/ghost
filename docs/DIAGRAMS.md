# Ghost Treasury — Full Visual Guide

## One Sentence

> **An AI agent that manages a DAO's money privately — members deposit openly, the agent trades secretly, and no one on-chain can see the strategy.**

---

## THE PROBLEM (Why This Exists)

```
TODAY: Every DAO treasury is naked on-chain

    DAO Treasury Wallet: 0xDAO...
    +----------------------------------+
    |  Balance: $2.4M USDC            |  <-- EVERYONE can see this
    |  Last trade: Bought 400 ETH     |  <-- COMPETITORS see this
    |  Next move: Probably more ETH   |  <-- MEV BOTS front-run this
    |  Member salaries: All visible   |  <-- PRIVACY violation
    +----------------------------------+
         |
         v
    +--------------+  +--------------+  +--------------+
    |  MEV Bot     |  |  Competitor  |  |  Journalist  |
    |  Front-runs  |  |  Copies      |  |  Leaks       |
    |  every trade |  |  strategy    |  |  salaries    |
    +--------------+  +--------------+  +--------------+

    Result: DAOs lose millions. Members get doxxed.
    $25B+ in DAO treasuries are fully exposed right now.
```

---

## THE SOLUTION (What Ghost Treasury Does)

```
GHOST TREASURY: The money disappears into a privacy pool

    Member deposits 1000 USDC
         |
         v
    +----------------------------------------------+
    |         UNLINK PRIVACY POOL (ZK)             |
    |                                              |
    |   ########################################   |
    |   # Your 1000 USDC is now a "note"       #   |
    |   # Only YOU can see it (viewing key)    #   |
    |   # No one else knows it's yours         #   |
    |   ########################################   |
    |                                              |
    |   The pool holds EVERYONE's money.           |
    |   Individual balances? Invisible.            |
    |   Who owns what? Invisible.                  |
    |   What's moving? Invisible.                  |
    +---------------------+------------------------+
                          |
                          v
                 +----------------+
                 |  AI AGENT      |
                 |  (Claude)      |
                 |                |
                 |  Has the       |
                 |  viewing key   |
                 |  + spending    |
                 |  authority     |
                 |  within RULES  |
                 +----------------+
                          |
                          v
            "I see the treasury has $50K.
             Rules say max 10% per trade.
             Let me check ETH price..."
                          |
                          v
    +----------------------------------------------+
    |            x402 DATA PURCHASE                |
    |                                              |
    |  Agent: GET /price/eth                       |
    |  Server: 402 Payment Required ($0.001)       |
    |  Agent: *pays with burner account*           |
    |  Server: ETH = $3,847.22                     |
    |                                              |
    |  The burner account is NOT linked to the     |
    |  treasury. No one can trace this purchase    |
    |  back to the DAO.                            |
    +---------------------+------------------------+
                          |
                          v
    +----------------------------------------------+
    |         PRIVATE SWAP (DeFi Adapter)           |
    |                                              |
    |  1. Unshield 5000 USDC from pool             |
    |  2. Swap USDC -> ETH on Uniswap             |
    |  3. Reshield ETH back into pool              |
    |                                              |
    |  All 3 steps = ONE atomic transaction        |
    |  On block explorer? Just a contract call.    |
    |  WHO traded? Unknown.                        |
    |  HOW MUCH? Unknown.                          |
    |  WHAT strategy? Unknown.                     |
    +----------------------------------------------+
```

---

## HOW IT ACTUALLY WORKS (Technical Dataflow)

```
+---------------------------------------------------------------------+
|                        GHOST TREASURY DATAFLOW                       |
|                     All on Monad Testnet (10143)                     |
|                        400ms blocks, 800ms finality                  |
+---------------------------------------------------------------------+

STEP 1: DEPOSIT (Public -> Private)
====================================

  Member's Wallet                    Unlink Pool Contract
  (MetaMask)                         (0x0813...on Monad)
       |                                    |
       |  "Deposit 1000 USDC"               |
       |----------------------------------->|
       |                                    |
       |   Visible on-chain:               |
       |   * WHO deposited (wallet addr)   |
       |   * HOW MUCH (1000 USDC)          |
       |   * INTO what contract            |
       |                                    |
       |   Created privately:              |
       |   * Note = {value, commitment,    |
       |     nullifier, blinding_factor}   |
       |   * Only viewable with            |
       |     viewing_key                   |
       +------------------------------------+


STEP 2: AI AGENT REASONING (Off-chain)
=======================================

  +------------------------------------------------------+
  |              AGENT BACKEND (Node.js :3001)            |
  |                                                       |
  |  +-------------+     +------------------------+      |
  |  | Claude API  |     | Unlink Node SDK        |      |
  |  |             |     |                        |      |
  |  | System:     |     | wallet.balances()      |      |
  |  | "You manage |---->|  -> {USDC: 50000,      |      |
  |  |  a private  |     |     MON: 1200,         |      |
  |  |  treasury.  |     |     ETH: 0}            |      |
  |  |  Rules:     |     |                        |      |
  |  |  - Max 10%  |     | (reads via viewing key |      |
  |  |    per trade|     |  -- never leaves server)|     |
  |  |  - No       |     +------------------------+      |
  |  |    leverage"|                                      |
  |  |             |     +------------------------+      |
  |  | Thinks:     |     | x402 Fetch             |      |
  |  | "ETH looks  |---->|                        |      |
  |  |  good, let  |     | payFetch("/price/eth") |      |
  |  |  me check   |     |  -> pays $0.001 USDC   |      |
  |  |  the price" |     |  -> via burner account  |      |
  |  |             |     |  -> gets: $3,847.22     |      |
  |  +-------------+     +------------------------+      |
  |                                                       |
  |  Agent Decision: "Buy 5000 USDC worth of ETH"        |
  |                                                       |
  |  +------------------------------------------------+  |
  |  |         3-LAYER SAFETY CHECK                    |  |
  |  |                                                 |  |
  |  |  Layer 1: Claude self-checks                    |  |
  |  |    "5000 = 10% of 50000 -- within rules"        |  |
  |  |                                                 |  |
  |  |  Layer 2: App validator                         |  |
  |  |    validateTrade({amount: 5000,                 |  |
  |  |      maxPct: 10, balance: 50000}) OK            |  |
  |  |                                                 |  |
  |  |  Layer 3: Smart contract (on-chain)             |  |
  |  |    GhostVault.sol enforces hard limits          |  |
  |  |    even if layers 1+2 are bypassed              |  |
  |  +------------------------------------------------+  |
  +------------------------------------------------------+


STEP 3: PRIVATE SWAP (On-chain, invisible)
==========================================

  Agent calls: unlink.interact({
    adapterAddress: "0xADAPTER...",
    inputs: [{token: USDC, amount: 5000}],
    calls: [
      {to: USDC, data: approve(router, 5000)},
      {to: router, data: swapExactTokensForTokens(
        5000, minETH, [USDC, WETH], adapter, deadline
      )}
    ],
    reshields: [{token: WETH, minAmount: minETH}]
  })

  What happens on Monad:
  +----------------------------------------------+
  |  SINGLE ATOMIC TRANSACTION                   |
  |                                              |
  |  1. Unshield: USDC note -> 5000 USDC        |
  |     (nullifier revealed, note consumed)      |
  |                                              |
  |  2. Approve: USDC.approve(router, 5000)      |
  |                                              |
  |  3. Swap: router.swap(USDC -> WETH)          |
  |                                              |
  |  4. Reshield: WETH -> new private note       |
  |     (new commitment, new blinding factor)    |
  |                                              |
  |  If ANY step fails -> ALL revert             |
  +----------------------------------------------+

  What a block explorer sees:
  +----------------------------------------------+
  |  tx: 0xabc123...                             |
  |  from: Unlink Relayer                        |
  |  to: Unlink Pool (0x0813...)                 |
  |  method: interact()                          |
  |  status: Success                             |
  |                                              |
  |  WHO traded? Unknown                         |
  |  HOW MUCH?   Unknown                         |
  |  WHAT FOR?   Unknown                         |
  +----------------------------------------------+


STEP 4: MEMBER VIEWS RESULTS (Private)
=======================================

  Member opens dashboard -> connects wallet
  Dashboard uses viewing key to decrypt notes
  Shows: "Agent bought 1.3 ETH at $3,847"
  But this info ONLY exists in the member's browser
```

---

## MOCK DEMO UI (What Judges See)

```
+------------------------------------------------------------------+
|  Ghost Treasury                             [Connect Wallet]      |
|  ----------------------------------------------------------------|
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                    TREASURY OVERVIEW                         |  |
|  |                                                             |  |
|  |    Total Value        24h Change        Members              |  |
|  |    ##########         ##########        ##########           |  |
|  |    $52,340            +2.4%             3 of 5               |  |
|  |                                                             |  |
|  |    +----------------------------------------------+         |  |
|  |    |  USDC   ====================---  78%         |         |  |
|  |    |  ETH    =====----------------  15%           |         |  |
|  |    |  MON    ==-------------------   7%           |         |  |
|  |    +----------------------------------------------+         |  |
|  |                                                             |  |
|  |    Privacy Status: FULLY SHIELDED                           |  |
|  |    On-chain visibility: NONE                                |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +------------+  +------------+  +------------+  +----------+    |
|  |  Deposit   |  |  Rules     |  |  Activity  |  | Withdraw |    |
|  +------------+  +------------+  +------------+  +----------+    |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                    AGENT CHAT                                |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+  |  |
|  |  | You: What's our position?                            |  |  |
|  |  +------------------------------------------------------+  |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+  |  |
|  |  | Ghost Agent:                                         |  |  |
|  |  |                                                       |  |  |
|  |  | Treasury holds $52,340 across 3 assets:              |  |  |
|  |  | * 40,825 USDC (78%)                                  |  |  |
|  |  | * 3.12 ETH worth $7,851 (15%)                        |  |  |
|  |  | * 1,200 MON worth $3,664 (7%)                        |  |  |
|  |  |                                                       |  |  |
|  |  | I purchased ETH 2 hours ago after x402 price         |  |  |
|  |  | data showed strong momentum. The trade was            |  |  |
|  |  | executed privately -- no on-chain trace to us.        |  |  |
|  |  |                                                       |  |  |
|  |  | Recommendation: Hold current positions.               |  |  |
|  |  | ETH is up 2.4% since purchase.                       |  |  |
|  |  +------------------------------------------------------+  |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+  |  |
|  |  | You: Swap 5000 USDC to ETH                           |  |  |
|  |  +------------------------------------------------------+  |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+  |  |
|  |  | Ghost Agent:                                         |  |  |
|  |  |                                                       |  |  |
|  |  | Checking constraints...                               |  |  |
|  |  | * Amount: 5,000 USDC (9.6% of treasury) OK           |  |  |
|  |  | * Max single trade: 10% OK                            |  |  |
|  |  | * Slippage tolerance: 1% OK                           |  |  |
|  |  |                                                       |  |  |
|  |  | Fetching price via x402...                            |  |  |
|  |  | Paid $0.001 USDC from burner account                  |  |  |
|  |  | ETH price: $3,847.22                                  |  |  |
|  |  |                                                       |  |  |
|  |  | Executing private swap via DeFi adapter...            |  |  |
|  |  | [OK] Unshielded 5,000 USDC                           |  |  |
|  |  | [OK] Swapped for 1.298 ETH                           |  |  |
|  |  | [OK] Reshielded 1.298 ETH                            |  |  |
|  |  |                                                       |  |  |
|  |  | Trade complete. Fully private.                        |  |  |
|  |  | Tx: 0xabc...def (no trace to treasury)                |  |  |
|  |  +------------------------------------------------------+  |  |
|  |                                                             |  |
|  |  +---------------------------------------------+           |  |
|  |  |  Type a message...                    [Send]|           |  |
|  |  +---------------------------------------------+           |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                  ACTIVITY LOG                                |  |
|  |                                                             |  |
|  |  14:32  Agent swapped 5,000 USDC -> 1.298 ETH   PRIVATE   |  |
|  |  14:32  Agent purchased price data ($0.001)      BURNER    |  |
|  |  12:15  Agent swapped 3,000 USDC -> 0.82 ETH    PRIVATE   |  |
|  |  12:14  Agent purchased price data ($0.001)      BURNER    |  |
|  |  09:00  Member Alice deposited 10,000 USDC       PUBLIC    |  |
|  |  08:45  Member Bob deposited 5,000 USDC          PUBLIC    |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                TREASURY RULES                                |  |
|  |                                                             |  |
|  |  Max single trade:     10% of treasury    [Edit]           |  |
|  |  Allowed assets:       USDC, ETH, MON     [Edit]           |  |
|  |  Rebalance frequency:  Every 4 hours      [Edit]           |  |
|  |  Leverage:             DISABLED           [Edit]           |  |
|  |  Withdrawal:           Any member, anytime [Edit]          |  |
|  |                                                             |  |
|  |  Rules enforced by: GhostVault.sol (on-chain)              |  |
|  |  Even the AI cannot break these rules.                      |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## THE MOAT (5-Layer Defense)

```
+------------------------------------------------------------------+
|                     5-LAYER MOAT                                  |
|                                                                   |
|  Each layer is useless without the others.                       |
|  You need ALL FIVE to make this work.                            |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  LAYER 5: MONAD SPEED                                      |  |
|  |  400ms blocks make private trades feel instant              |  |
|  |  Try this on Ethereum (12s blocks) -- unusable              |  |
|  +------------------------------------------------------------+  |
|  |  LAYER 4: x402 MICRO-PAYMENTS                              |  |
|  |  Agent pays for data without revealing identity             |  |
|  |  Burner accounts = untraceable data purchases               |  |
|  +------------------------------------------------------------+  |
|  |  LAYER 3: AI REASONING                                      |  |
|  |  Claude analyzes, decides, executes autonomously            |  |
|  |  Tool-use loop with constraint validation                   |  |
|  +------------------------------------------------------------+  |
|  |  LAYER 2: ZK PRIVACY (UNLINK)                              |  |
|  |  Deposits, trades, balances -- all hidden via ZK proofs     |  |
|  |  UTXO notes, nullifiers, viewing keys                      |  |
|  +------------------------------------------------------------+  |
|  |  LAYER 1: SMART CONTRACT ENFORCEMENT                       |  |
|  |  GhostVault.sol enforces rules even if AI goes rogue       |  |
|  |  On-chain, immutable, trustless                            |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  Remove any layer:                                               |
|  * No Monad    -> too slow, bad UX                               |
|  * No x402     -> agent leaks identity buying data               |
|  * No AI       -> just a privacy pool (boring, already exists)   |
|  * No Unlink   -> trades are public (defeats the purpose)        |
|  * No contract -> must trust the AI (terrifying)                 |
+------------------------------------------------------------------+
```

---

## WHY IT'S COOL (In Human Terms)

```
TRADITIONAL FUND MANAGER          GHOST TREASURY
=========================         ==================
You give money to a person        You give money to a pool
That person trades for you        An AI trades for you
Everyone sees the trades          NO ONE sees the trades
The person could steal it         Smart contract prevents theft
You wait days for reports         You see results instantly
Costs 2% + 20% of gains          Costs gas fees only
Requires $100K minimum           Requires any amount
Needs a broker, bank, KYC        Needs a wallet, that's it

AND:
* The AI explains its reasoning in plain English
* You set the rules, the contract enforces them
* You can withdraw YOUR share anytime
* An auditor with a viewing key can verify compliance
* But the PUBLIC sees nothing
```

---

## WHY IT'S RELEVANT TO THIS HACKATHON

```
HACKATHON REQUIREMENT               HOW WE HIT IT
=======================              ==============

"Ship Private"                       Unlink ZK pool hides everything.
                                     Literally the name of the event.

"Use Unlink SDK"                     Core of the product. Deposit,
                                     transfer, DeFi adapter, burner
                                     accounts -- we use ALL of it.

"Build on Monad"                     Single-chain. Everything on
                                     testnet 10143. 400ms blocks
                                     make private trades instant.

"x402 Integration"                   Agent pays for market data
                                     via x402 using burner accounts.
                                     Privacy-preserving data access.

"Treasury Track"                     Literally a treasury manager.
                                     1-3 competitors expected.

"x402 Agents Track"                  Literally an AI agent using x402.
                                     0-2 competitors expected.

JUDGES WANT TO SEE:
+-- Iqram (Venmo)     -> Clean UI, "your mom could use it"
+-- Viktor (Coinbase) -> Privacy as infrastructure, not gimmick
+-- Sean (Aztec)      -> ZK done right, clear public/private split
+-- David (ZK-Sec)    -> Honest threat model, trust assumptions
+-- Jonah (BC Cap)    -> "$25B market, investable"
+-- Fitz (Monad)      -> Uses Monad's speed for real advantage
+-- Jason (EF)        -> "Permissionless, self-custodial, open source"
+-- Aryan (CMT)       -> Institutional trading use case

We hit EVERY judge with ONE product.
```

---

## COMPARISON: US vs WHAT EXISTS

```
+---------------+---------------+---------------+------------------+
|               | Tornado Cash  | Regular DAO   | GHOST TREASURY   |
|               | (sanctioned)  | (Gnosis Safe) | (what we build)  |
+---------------+---------------+---------------+------------------+
| Privacy       | Full          | None          | Full (ZK)        |
| Compliance    | Zero          | Full          | Viewing keys     |
| AI agent      | No            | No            | Yes (Claude)     |
| Auto-trading  | No            | Manual only   | AI-driven        |
| Data access   | N/A           | Public APIs   | x402 (private)   |
| Speed         | 12s (ETH)     | 12s (ETH)     | 400ms (Monad)    |
| Trust model   | Code only     | Multisig      | Code + AI + Rules|
| Legal status  | SANCTIONED    | Legal         | Legal            |
+---------------+---------------+---------------+------------------+

We're in the only quadrant that's BOTH private AND compliant.
That's the unlock. That's what Viktor and Jonah will get excited about.
```

---

## THE DEMO FLOW (Exact 3-Minute Sequence)

```
MINUTE 0:00 -- THE HOOK
========================
Presenter: "DAO treasuries hold $25 billion on public blockchains.
Every trade is visible. MEV bots front-run them. Competitors
copy their strategy. It's like playing poker with your cards
face up. Ghost Treasury fixes this."

MINUTE 0:30 -- LIVE DEMO
=========================
[Screen: Dashboard showing $0 balance]

Presenter: "Watch. I'm depositing 100 USDC into the privacy pool."

[Click Deposit -> MetaMask pops up -> Confirm]
[Balance appears: 100 USDC, Privacy: SHIELDED]

Presenter: "That 100 USDC is now invisible on-chain. Let me prove it."

[Open MonadScan in split screen -> show the deposit tx]
[Point: "See? The contract received tokens. But WHO deposited?
The pool. Not me."]

MINUTE 1:00 -- THE AGENT
=========================
[Switch to Agent Chat]

Presenter types: "Check ETH price and buy if under $4000"

[Agent responds in real-time]:
  "Fetching ETH price via x402... paid $0.001 from burner.
   ETH = $3,847. Under your $4,000 threshold.
   Executing private swap: 50 USDC -> ETH..."

[Progress indicators animate]

  "OK Trade complete. Acquired 0.013 ETH.
   Fully private. No on-chain trace."

MINUTE 1:30 -- THE PROOF
=========================
[Open MonadScan again]

Presenter: "Here's the transaction on the block explorer.
You can see the Unlink pool contract was called.
But find the amount. Find the trader. Find the strategy.
You can't. That's Ghost Treasury."

MINUTE 2:00 -- THE SAFETY
==========================
Presenter types: "Swap 100% of treasury to a random memecoin"

[Agent responds]:
  "Rejected. Your rules cap trades at 10% of treasury.
   This request would exceed the limit.
   Even if I wanted to execute this, the on-chain
   constraint contract would block it."

Presenter: "The AI can't go rogue. Smart contract says no."

MINUTE 2:30 -- THE VISION
==========================
Presenter: "Ghost Treasury is permissionless, self-custodial,
open-source infrastructure. Any DAO can deploy one and stop
playing poker with their cards face up.

Privacy isn't a feature. It's the prerequisite for
institutional DeFi. Thank you."
```

---

## FULL SYSTEM ARCHITECTURE

```
+------------------------------------------------------------+
|                 ALL ON MONAD TESTNET (10143)                |
|                                                            |
|  +-------------+    +--------------+    +--------------+   |
|  | REACT UI    |    | AGENT CORE   |    | DEMO APIs    |   |
|  | :5173       |<-->| :3001        |<-->| :3002        |   |
|  |             |    |              |    |              |   |
|  | @unlink-xyz |    | Claude API   |    | @x402/express|   |
|  | /react      |    | @unlink-xyz  |    | Price feeds  |   |
|  |             |    | /node        |    | behind x402  |   |
|  | Deposit     |    | @x402/fetch  |    | paywall      |   |
|  | Dashboard   |    |              |    |              |   |
|  | Chat        |    | Validator    |    | Facilitator: |   |
|  | Activity    |    | Constraints  |    | molandak.org |   |
|  +-------------+    +------+-------+    +--------------+   |
|                            |                                |
|  +-------------------------v-------------------------+     |
|  |              MONAD TESTNET                        |     |
|  |                                                   |     |
|  |  Unlink Pool (0x0813...)  <-> DeFi (Uniswap V2)  |     |
|  |  USDC (0x534b...)         <-> GhostVault.sol      |     |
|  |  MON (native)             <-> x402 settlement     |     |
|  +---------------------------------------------------+     |
+------------------------------------------------------------+

Everything on one chain. No bridging. No dual-chain complexity.
```
