# GHOST TREASURY — DEMO NARRATION

> Open this in Warp next to the demo. Read each section when Claude navigates to it.
> Claude handles all browser actions. You just read.

---

## 1. PROBLEM STATEMENT

*Screen: Overview dashboard visible*

DAOs hold over 25 billion dollars on public blockchains.
Every trade is visible. Every strategy is exposed.

MEV bots front-run these trades —
basically stealing money by trading milliseconds ahead.

It's like playing poker with your cards face up.

Ghost Treasury solves this.

It's an AI-powered treasury manager
that operates inside a privacy pool.

Members deposit openly,
the agent trades secretly,
and no one on-chain can see the strategy.

Built on Monad for speed,
Unlink for privacy,
x402 for paid market intelligence,
and Claude Sonnet 4.6 as the AI brain.

Let me show you how it works.

---

## 2. DASHBOARD TOUR

*Screen: Overview tab*

Here's Ghost Treasury.

We're connected with our wallet.
The DAO holds 73 dollars across three tokens —
USDC, WMON, and MON.

Everything is fully shielded
inside Unlink's privacy pool.

On the left — the allocation breakdown:
65 percent stablecoins,
21 percent WMON,
14 percent MON.

Below that, my position:
I deposited 25 dollars,
giving me 34 percent share
and 34 percent voting power.

Governance is proportional to your stake.

---

## 3. ACTIVITY TAB

*Screen: Claude clicks Activity tab*

The activity ledger shows everything
the agent has done.

Deposits. Private swaps.
Strategy evaluations.
Even x402 micropayments for price data.

Notice the shield icons —
those transactions are invisible on-chain.

---

## 4. MEMBERS TAB

*Screen: Claude clicks Members tab*

Two members in the pool.

My account at the top —
full address, share percentage, voting power.

The treasury founder below with 66 percent.

Every member's influence
is proportional to their deposit.

---

## 5. CHECK POSITION

*Screen: Claude clicks "Check position" button*

Let's talk to the agent.

"What's our current position?"

*Wait for agent response...*

The agent queries the Unlink privacy pool
using a viewing key.

It can see our balances —
but nobody else on-chain can.

It returns a full portfolio breakdown
with amounts, dollar values,
and allocation percentages.

---

## 6. THE SAFETY TEST

*Screen: Claude clicks "100% memecoin" button*

Now the critical test.

What happens when someone asks the agent
to do something reckless?

"Swap 100 percent to memecoin."

*Wait for agent response...*

Rejected.

Three layers of safety kicked in.

First — the AI itself recognizes
this violates the rules.

Second — our application validator
blocks any trade over 10 percent of the treasury.

Third — even if both of those failed —
the GhostVault smart contract on Monad
physically blocks it on-chain.

The contract is immutable.
You can't talk it into breaking the rules.

---

## 7. PRIVACY MODEL

*Screen: Claude types "Who can see our trades?" and sends*

Let me ask the agent about our privacy model.

*Wait for agent response...*

The agent explains it clearly.

Deposits are public going in.
But once funds enter the Unlink pool,
all activity is completely invisible.

Transfers, swaps, strategy —
hidden from everyone.

The only public moment
is when money exits.

This is how institutional DeFi should work.

---

## 8. CONSTRAINTS

*Screen: Claude clicks Settings tab*

Here are the constraints
the community set.

Maximum 10 percent per trade.
5-minute cooldown between trades.
Only whitelisted tokens allowed.

The agent can't override these.
They're enforced by smart contract.

And here's what makes this special.

We've executed real swaps on Monad testnet.
You can go to MonadScan,
find the transaction,
and you'll see it —
a call to the Unlink pool.

But find the amount.
Find the trader.
Find the strategy.

You can't.

That's Ghost Treasury.

---

## 9. CLOSE

*Screen: Claude clicks back to Overview*

Permissionless.
Self-custodial.
Privacy-first.
Open source.

Built in 48 hours.

Ghost Treasury —
because privacy isn't a feature,
it's the prerequisite for institutional DeFi.

---

## IF AGENT IS SLOW

> "The agent is reasoning through its constraint checks
> and querying the privacy pool —
> this is real AI decision-making, not a script."

## IF AGENT ERRORS

> Skip to the next section. The dashboard and settings
> tell the story visually.
