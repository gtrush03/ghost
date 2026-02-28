# VALIDATED FINDINGS — Unlink + Monad + x402

## Status: ALL ON MONAD (Single Chain Architecture Confirmed)

### Previous assumption was WRONG:
We thought Unlink might be limited to Base/Polygon and x402 wouldn't work on Monad.

### Reality:
- Unlink SDK supports ONLY Monad Testnet — it's the only chain
- x402 has a working Monad testnet facilitator
- Everything runs on one chain

---

## Unlink SDK — Verified Facts

| Fact | Value | Source |
|------|-------|--------|
| Supported chain | Monad Testnet ONLY (chain ID 10143) | docs.unlink.xyz/getting-started |
| Init method | `initUnlink({ chain: "monad-testnet" })` | Auto-resolves everything |
| Pool contract | `0x0813da0a10328e5ed617d37e514ac2f6fa49a254` | Getting Started page |
| Gateway | `https://api.unlink.xyz` | Free, no auth |
| Native token address | `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` | For MON deposits |
| Faucet | `https://faucet.unlink.xyz` | Get testnet tokens |
| Storage | Use `createSqliteStorage({ path: "./wallet.db" })` for persistence | Node SDK docs |
| Multisig | FROST threshold signing (m-of-n), indistinguishable from single-signer | SDK docs |
| DeFi adapter address | **NOT DOCUMENTED — ASK MENTORS** | Placeholder only in docs |
| Burner key export | **NOT DOCUMENTED — ASK MENTORS** | Critical for x402 integration |
| Supported tokens in pool | Only MON explicitly confirmed | ERC-20 support implied |
| Proof generation time | **NOT DOCUMENTED** | Test at venue |

### Privacy Model (Verified)

| Operation | Amount | Sender | Recipient | Token |
|-----------|--------|--------|-----------|-------|
| Deposit | PUBLIC | PUBLIC | PRIVATE | PUBLIC |
| Transfer | PRIVATE | PRIVATE | PRIVATE | PRIVATE |
| Withdraw | PUBLIC | PRIVATE | PUBLIC | PUBLIC |

### Key Types
- **Spending Key** — authorize transactions (spend notes)
- **Viewing Key** — decrypt incoming notes (see balances)
- **Nullifying Key** — compute nullifiers (mark notes as spent)
- Any single keyholder can VIEW balances, but SPENDING requires threshold agreement (multisig)

### UTXO Model
- Notes = UTXOs with commitment, nullifier, random blinding
- Each note: `{ token, value, commitment, npk, mpk, random, nullifier, spentAtIndex }`
- Notes consumed on spend (nullifier revealed), new notes created for recipient

### DeFi Adapter (Verified)
- Primary method: `unlink.interact(params, opts?)`
- Flow: unshield from pool → execute DeFi calls → reshield back
- Swap recipient MUST be `adapterAddress` (not your address)
- Supports multi-step calls in one atomic transaction
- Dry run: `unlink.interact(params, { skipBroadcast: true })`
- Reshields support `minAmount` for slippage protection

### Gateway Trust Model
- **NOT DOCUMENTED** — major gap
- Gateway relays transactions and tracks status
- States: pending → broadcasting → submitted → succeeded | reverted | failed | dead
- Unknown: censorship resistance, front-running protection, failure fallback

---

## Monad Testnet — Verified Facts

| Fact | Value |
|------|-------|
| Chain ID | 10143 |
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Block time | 400ms |
| Finality | 800ms (2 slots) |
| Gas model | EIP-1559, min base fee 100 MON-gwei |
| **Gas charging** | **CHARGED ON GAS LIMIT, NOT GAS USED** |
| EVM version | `prague` (MUST set in compiler) |
| Block gas limit | 200M |
| Tx gas limit | 30M |
| Explorer | `https://testnet.monadscan.com` |
| WMON | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| Parallel execution | Transparent to contracts, no code changes needed |

### Deployed DEXes on Testnet
- Uniswap V2 (pools active)
- IziSwap
- Bean Exchange (spot + perps)
- Kuru
- PancakeSwap

### USDC on Monad Testnet
- Address: `0x534b2f3A21130d7a60830c2Df862319e593943A3` (from Monad x402 guide)
- Also: `0x62534e4bbd6d9ebac0ac99aeaa0aa48e56372df0` (from SocialScan)
- EIP-3009 support: UNVERIFIED but likely (x402 guide shows it working)

### Faucets (ALL of them)
| Faucet | URL | Amount | Cooldown |
|--------|-----|--------|----------|
| Official | faucet.monad.xyz | 0.05 MON | 6 hours |
| QuickNode | faucet.quicknode.com/monad/testnet | ? | 12 hours |
| Chainlink | faucets.chain.link/monad-testnet | ? | ? |
| Alchemy | alchemy.com/faucets/monad-testnet | ? | 24 hours |
| ETHGlobal | ethglobal.com/faucet/monad-testnet-10143 | ? | ? |
| Gas.zip | gas.zip/faucet/monad | Up to 0.5 MON | ? |
| Morkie | faucet.morkie.xyz/monad | 0.5 MON | 24 hours |

**No dedicated USDC faucet.** Swap MON for USDC on a testnet DEX.

---

## x402 on Monad — Verified Facts

| Fact | Value |
|------|-------|
| Monad supported | YES — via third-party facilitator |
| Facilitator URL | `https://x402-facilitator.molandak.org` |
| USDC address | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| Network ID (CAIP-2) | `eip155:10143` |
| Payment standard | EIP-3009 `transferWithAuthorization` |
| Gas paid by | Facilitator (NOT the client) |
| Fallback facilitator | `https://x402.org/facilitator` (Base Sepolia only) |

### Server Setup (Monad Testnet)
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
      payTo: "0xYOUR_ADDRESS",
      price: "$0.001",
    },
    description: "ETH price feed",
  },
}, server));
```

### Client Setup
```typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client();
registerExactEvmScheme(client, {
  signer: privateKeyToAccount("0xBURNER_PRIVATE_KEY"),
});

const payFetch = wrapFetchWithPayment(fetch, client);
const res = await payFetch("http://localhost:3001/price/eth");
```

---

## "Ship Private" — The Thesis (Validated)

### What It Means
- **Privacy is the primitive** — not a feature, not an add-on
- **Compliant, not anonymous** — NOT Tornado Cash. Viewing keys enable selective disclosure for auditors
- **On-chain, not a sidecar** — smart contract on Monad itself, no bridging, no L2
- **Speed enables privacy at scale** — Monad's 400ms blocks make private transactions practical

### How Unlink Differs from Competitors
| Protocol | Type | Privacy | Compliance |
|----------|------|---------|------------|
| Tornado Cash | Mixer | Full anonymity | NONE (sanctioned) |
| Aztec | L2 | Default privacy | In development |
| Zcash | Separate chain | Shielded txs | View keys |
| Railgun | Privacy pool | ZK proofs | Proof of innocence |
| **Unlink** | **Smart contract on existing chain** | **ZK proofs** | **Viewing keys** |

### Track Requirements
1. **Neobank**: "Onchain self-custodial bank where your financial life isn't public"
2. **x402 Agents**: "Autonomous agents that execute confidential transactions"
3. **Payroll**: "Onchain salaries and contractor invoicing that stay confidential"
4. **Stablecoin**: "Move dollars without exposing your balance sheet"
5. **DeFi**: "Trade, borrow, lend without leaking alpha"
6. **Treasury**: "Manage organization funds without broadcasting strategies"

### Judging: No formal criteria published. Inferred from judge panel:
- ZK/Privacy depth (Sean C from Aztec, David Wong from ZK-Security)
- Business viability (Iqram from Venmo, Jonah from Blockchain Capital)
- Ecosystem fit (Fitz from Monad, Jason from EF)
- Compliance angle (Viktor from Coinbase)

---

## Questions to Ask Mentors TONIGHT

### At Unlink Workshop (8PM):
1. "What's the DeFi adapter contract address on Monad testnet?"
2. "Can I export a burner account's private key? I need it for x402 signing."
3. "What ERC-20 tokens are supported in the pool besides MON?"
4. "What's the typical proof generation time on Node.js?"
5. "Is the gateway a trust assumption? Can transactions be submitted directly to the pool contract?"

### At Monad Workshop:
1. "Does the testnet USDC at 0x534b... support EIP-3009 (transferWithAuthorization)?"
2. "Is there a USDC faucet or do we need to swap MON?"
3. "Any Monad-specific things to watch out for with ZK proof contracts?"

---

## Updated Architecture (Single Chain)

```
┌────────────────────────────────────────────────────────────┐
│                 ALL ON MONAD TESTNET (10143)                │
│                                                            │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ REACT UI    │    │ AGENT CORE   │    │ DEMO APIs    │  │
│  │ :5173       │◄──►│ :3001        │◄──►│ :3002        │  │
│  │             │    │              │    │              │  │
│  │ @unlink-xyz │    │ Claude API   │    │ @x402/express│  │
│  │ /react      │    │ @unlink-xyz  │    │ Price feeds  │  │
│  │             │    │ /node        │    │ behind x402  │  │
│  │ Deposit     │    │ @x402/fetch  │    │ paywall      │  │
│  │ Dashboard   │    │              │    │              │  │
│  │ Chat        │    │ Validator    │    │ Facilitator: │  │
│  │ Activity    │    │ Constraints  │    │ molandak.org │  │
│  └─────────────┘    └──────┬───────┘    └──────────────┘  │
│                            │                               │
│  ┌─────────────────────────▼─────────────────────────┐    │
│  │              MONAD TESTNET                         │    │
│  │                                                    │    │
│  │  Unlink Pool (0x0813...)  ←→  DeFi (Uniswap V2)  │    │
│  │  USDC (0x534b...)         ←→  GhostVault.sol      │    │
│  │  MON (native)             ←→  x402 settlement     │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

Everything on one chain. No bridging. No dual-chain complexity.
This is cleaner, simpler, and more impressive to judges.
