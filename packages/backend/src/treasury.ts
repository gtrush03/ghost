import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import express from "express";
import cors from "cors";
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createAgentClients, createAgentWallet, getUnlinkAddress, monadTestnet, RPC_URL } from "./config.js";
import { DEX_ROUTER_ADDRESS } from "@ghost/shared";
import { createUnlinkService } from "./services/unlink.js";
import { createAgentRouter } from "./routes/agent.js";
import { createAuthRouter, requireAuth } from "./routes/auth.js";
import { createMembersRouter } from "./routes/members.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createActivityRouter } from "./routes/activity.js";
import { createStrategyRouter } from "./routes/strategy.js";
import { startStrategyLoop } from "./agent/strategy.js";
import { toolCheckBalance, type ToolContext } from "./agent/tools.js";
import { initDatabase, ensureMember, createDeposit, confirmDeposit as confirmDepositDb, logActivity, createTrade } from "./services/db.js";
import { loadConstraints } from "./agent/validator.js";

const PORT = 3003;
const AGENT_NAME = "treasury";

const key = process.env.TREASURY_AGENT_KEY as `0x${string}`;
if (!key) throw new Error("TREASURY_AGENT_KEY not set in .env");

const { account } = createAgentClients(key);
console.log(`[${AGENT_NAME}] Public address: ${account.address}`);

// Initialize DAO database FIRST (instant, no network)
const db = initDatabase();
loadConstraints(db);
console.log(`[${AGENT_NAME}] SQLite DB initialized`);

// Seed founding member + demo member
const seedWallet = account.address.toLowerCase();
const seedMember = ensureMember(seedWallet, "Treasury Founder");
const existingDeps = (db.prepare("SELECT COUNT(*) as c FROM deposits WHERE member_id = ?").get(seedMember.id) as any);
if (existingDeps.c === 0) {
  createDeposit({
    memberId: seedMember.id,
    tokenAddress: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    amountRaw: "48000000",
    amountHuman: 48,
    amountUsd: 48,
    relayId: "seed-deposit",
  });
  db.prepare("UPDATE deposits SET status = 'confirmed', confirmed_at = datetime('now') WHERE relay_id = 'seed-deposit'").run();
  console.log(`[${AGENT_NAME}] Seeded founder member with $48 deposit`);
}

// Seed demo member (user's MetaMask wallet) with deposit
const demoWallet = "0xcb90eed962114aa45de3e0f02c52e6c4e8473c02";
const demoMember = ensureMember(demoWallet, "Demo Investor");
const demoDeps = (db.prepare("SELECT COUNT(*) as c FROM deposits WHERE member_id = ?").get(demoMember.id) as any);
if (demoDeps.c === 0) {
  createDeposit({
    memberId: demoMember.id,
    tokenAddress: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    amountRaw: "25000000",
    amountHuman: 25,
    amountUsd: 25,
    relayId: "demo-deposit-1",
  });
  db.prepare("UPDATE deposits SET status = 'confirmed', confirmed_at = datetime('now') WHERE relay_id = 'demo-deposit-1'").run();
  logActivity({
    eventType: "deposit",
    actorWallet: demoWallet,
    summary: "Deposited 25.00 USDC (~$25.00)",
    details: { token: "USDC", amountHuman: 25, amountUsd: 25 },
    privacy: "public",
  });
  console.log(`[${AGENT_NAME}] Seeded demo member with $25 deposit`);
}

// Seed trades and activity for realistic demo
const existingTrades = (db.prepare("SELECT COUNT(*) as c FROM trades").get() as any);
if (existingTrades.c === 0) {
  // Trade 1: Swapped some USDC to WMON
  createTrade({
    fromToken: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    fromSymbol: "USDC",
    toToken: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
    toSymbol: "WMON",
    amountIn: "15000000",
    amountInHuman: 15,
    amountUsd: 15,
    txHash: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    status: "confirmed",
    initiatedBy: "agent",
  });
  logActivity({
    eventType: "trade",
    summary: "Swapped 15.00 USDC → 35.71 WMON via privacy pool",
    details: { from: "USDC", to: "WMON", amountUsd: 15, amountOut: 35.71 },
    privacy: "shielded",
  });

  // Trade 2: Bought some MON with USDC
  createTrade({
    fromToken: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    fromSymbol: "USDC",
    toToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    toSymbol: "MON",
    amountIn: "10000000",
    amountInHuman: 10,
    amountUsd: 10,
    txHash: "0xb2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    status: "confirmed",
    initiatedBy: "agent",
  });
  logActivity({
    eventType: "trade",
    summary: "Swapped 10.00 USDC → 23.81 MON via privacy pool",
    details: { from: "USDC", to: "MON", amountUsd: 10, amountOut: 23.81 },
    privacy: "shielded",
  });

  // Add strategy activity
  logActivity({
    eventType: "strategy",
    summary: "Agent evaluated portfolio: maintaining 65/20/15 USDC/WMON/MON allocation",
    details: { allocation: { USDC: 65, WMON: 20, MON: 15 } },
    privacy: "public",
  });

  logActivity({
    eventType: "x402_payment",
    summary: "Agent purchased ETH price feed via x402 ($0.001)",
    details: { asset: "ETH", price: 3847, cost: 0.001 },
    privacy: "shielded",
  });

  console.log(`[${AGENT_NAME}] Seeded demo trades and activity`);
}

// Price feed URL
const priceFeedUrl = process.env.PRICE_FEED_URL ?? "http://localhost:3002";

// Tool context — unlinkService will be populated async after init
const toolCtx: ToolContext = {
  unlinkService: null as any, // Set after async init
  priceFeedUrl,
  burnerKey: undefined,
  db,
};

// Track Unlink init status
let unlinkReady = false;
let unlinkAddress = "initializing...";
let unlink: Awaited<ReturnType<typeof createAgentWallet>> | null = null;

// NON-BLOCKING Unlink initialization with 15s timeout
async function initUnlinkAsync() {
  try {
    console.log(`[${AGENT_NAME}] Initializing Unlink wallet (non-blocking)...`);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Unlink init timed out after 15s")), 15000)
    );
    const result = await Promise.race([createAgentWallet(AGENT_NAME), timeoutPromise]);
    unlink = result;
    unlinkAddress = await getUnlinkAddress(result);
    const unlinkService = createUnlinkService(result);
    toolCtx.unlinkService = unlinkService;
    unlinkReady = true;
    console.log(`[${AGENT_NAME}] Unlink address: ${unlinkAddress}`);

    // Now try burner
    try {
      const burnerAddr = await unlinkService.getBurnerAddress(0);
      console.log(`[${AGENT_NAME}] Burner address: ${burnerAddr}`);
      const burnerKey = await unlinkService.getBurnerKey(0);
      toolCtx.burnerKey = burnerKey;
      console.log(`[${AGENT_NAME}] Burner key loaded`);
    } catch (e: any) {
      console.log(`[${AGENT_NAME}] Burner not funded: ${e.message}`);
    }
  } catch (error: any) {
    console.log(`[${AGENT_NAME}] Unlink init failed: ${error.message}`);
    console.log(`[${AGENT_NAME}] Running in demo/DB-only mode — chat + members still work`);
  }
}
initUnlinkAsync();

// Fund MockRouter with MON (non-blocking)
async function fundMockRouter() {
  try {
    const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });
    const routerBalance = await publicClient.getBalance({ address: DEX_ROUTER_ADDRESS as `0x${string}` });
    const threshold = parseEther("10");
    if (routerBalance >= threshold) {
      console.log(`[${AGENT_NAME}] MockRouter has ${formatEther(routerBalance)} MON`);
      return;
    }
    console.log(`[${AGENT_NAME}] Funding MockRouter...`);
    const fundAccount = privateKeyToAccount(key);
    const walletClient = createWalletClient({ account: fundAccount, chain: monadTestnet, transport: http(RPC_URL) });
    const hash = await walletClient.sendTransaction({
      to: DEX_ROUTER_ADDRESS as `0x${string}`,
      value: threshold - routerBalance,
    });
    console.log(`[${AGENT_NAME}] Funded MockRouter — tx: ${hash}`);
  } catch (error: any) {
    console.log(`[${AGENT_NAME}] MockRouter funding skipped: ${error.message}`);
  }
}
fundMockRouter();

console.log(`[${AGENT_NAME}] Agent brain: ${process.env.OPENROUTER_API_KEY ? "OpenRouter" : "Demo Mode"}`);
console.log(`[${AGENT_NAME}] Price feed: ${priceFeedUrl}`);

// ========== EXPRESS SERVER (starts immediately) ==========
const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  process.env.PRODUCTION_ORIGIN,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    agent: AGENT_NAME,
    status: unlinkReady ? "ready" : "initializing",
    phase: 2,
    publicAddress: account.address,
    unlinkAddress,
    unlinkReady,
    brain: process.env.OPENROUTER_API_KEY ? "openrouter" : "demo",
    model: process.env.OPENROUTER_MODEL ?? "demo-mode",
  });
});

// Helper: get net pool value from DB deposits + trades
function getDbTreasuryValue(): { balances: Record<string, string>; totalValueUsd: number } {
  try {
    // Total deposited
    const depRow = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN status='confirmed' THEN amount_usd ELSE 0 END), 0) as deposited
      FROM deposits
    `).get() as any;
    const totalDeposited = depRow?.deposited ?? 0;

    // Calculate token balances from trades
    const trades = db.prepare(`SELECT from_symbol, to_symbol, amount_usd FROM trades WHERE status='confirmed'`).all() as any[];

    // Start with all deposits in USDC
    const tokenUsd: Record<string, number> = { USDC: totalDeposited };

    for (const t of trades) {
      // Subtract from source token
      tokenUsd[t.from_symbol] = (tokenUsd[t.from_symbol] ?? 0) - t.amount_usd;
      // Add to destination token
      tokenUsd[t.to_symbol] = (tokenUsd[t.to_symbol] ?? 0) + t.amount_usd;
    }

    // Build balances with approximate amounts
    const TOKEN_PRICES: Record<string, number> = { USDC: 1, WMON: 0.42, MON: 0.42, ETH: 3847 };
    const balances: Record<string, string> = {};
    let totalUsd = 0;

    for (const [symbol, usdVal] of Object.entries(tokenUsd)) {
      if (usdVal <= 0) continue;
      const price = TOKEN_PRICES[symbol] ?? 1;
      const amount = usdVal / price;
      balances[symbol] = amount.toFixed(symbol === "USDC" ? 2 : 4);
      totalUsd += usdVal;
    }

    return { balances, totalValueUsd: Math.round(totalUsd * 100) / 100 };
  } catch {
    return { balances: { USDC: "48.00" }, totalValueUsd: 48 };
  }
}

// Treasury state
app.get("/api/treasury/state", async (_req, res) => {
  try {
    if (unlinkReady) {
      const result = await toolCheckBalance(toolCtx) as any;
      // If Unlink returns 0 but DB has deposits, use DB value
      if (result.totalValueUsd === 0) {
        const dbVal = getDbTreasuryValue();
        res.json({ ...dbVal, privacyStatus: "shielded", lastUpdated: new Date().toISOString() });
        return;
      }
      res.json({ ...(result as object), lastUpdated: new Date().toISOString() });
      return;
    }
    const dbVal = getDbTreasuryValue();
    res.json({ ...dbVal, privacyStatus: "shielded", lastUpdated: new Date().toISOString(), note: "Unlink syncing" });
  } catch (error: any) {
    const dbVal = getDbTreasuryValue();
    res.json({ ...dbVal, privacyStatus: "shielded", error: error.message });
  }
});

// Auth routes
app.use("/api/auth", createAuthRouter());

// Agent chat routes
app.use("/api/agent", createAgentRouter(toolCtx));

// DAO routes
app.use("/api/members", createMembersRouter());
app.use("/api/treasury/settings", createSettingsRouter());
app.use("/api/activity", createActivityRouter());
app.use("/api/strategy", createStrategyRouter());

// Deposit — generate calldata
app.post("/api/treasury/deposit", async (req, res) => {
  try {
    const { depositor, token, amount, amountUsd } = req.body;
    if (!depositor || !token || !amount) {
      res.status(400).json({ error: "Missing depositor, token, or amount" });
      return;
    }
    if (amountUsd !== undefined && (typeof amountUsd !== "number" || amountUsd < 0)) {
      res.status(400).json({ error: "Invalid amountUsd" });
      return;
    }

    const member = ensureMember(depositor);

    if (!unlink) {
      // Unlink not ready — record deposit in DB only
      const amountNum = Number(amount);
      const decimals = token.toLowerCase() === "0x534b2f3a21130d7a60830c2df862319e593943a3" ? 6 : 18;
      const amountHuman = amountNum / 10 ** decimals;
      createDeposit({
        memberId: member.id,
        tokenAddress: token,
        amountRaw: amount.toString(),
        amountHuman,
        amountUsd: amountUsd ?? amountHuman,
        relayId: `local-${Date.now()}`,
      });
      const localRelayId = `local-${Date.now()}`;
      db.prepare("UPDATE deposits SET status = 'confirmed', confirmed_at = datetime('now') WHERE relay_id = ?").run(localRelayId);
      logActivity({
        eventType: "deposit",
        actorWallet: depositor,
        summary: `Deposited ${amountHuman.toFixed(2)} USDC (~$${(amountUsd ?? amountHuman).toFixed(2)})`,
        details: { token, amountHuman, amountUsd: amountUsd ?? amountHuman },
        privacy: "public",
      });
      res.json({ relayId: localRelayId, to: null, calldata: null, value: "0", memberId: member.id, note: "Recorded locally (Unlink syncing)" });
      return;
    }

    const deposit = await unlink.deposit({
      depositor,
      deposits: [{ token, amount: BigInt(amount) }],
    });

    const amountNum = Number(amount);
    const decimals = token.toLowerCase() === "0x534b2f3a21130d7a60830c2df862319e593943a3" ? 6 : 18;
    const amountHuman = amountNum / 10 ** decimals;
    createDeposit({
      memberId: member.id,
      tokenAddress: token,
      amountRaw: amount.toString(),
      amountHuman,
      amountUsd: amountUsd ?? amountHuman,
      relayId: deposit.relayId,
    });

    logActivity({
      eventType: "deposit",
      actorWallet: depositor,
      summary: `Deposited ${amountHuman.toFixed(2)} ${token === "0x534b2f3A21130d7a60830c2Df862319e593943A3" ? "USDC" : "tokens"} (~$${(amountUsd ?? amountHuman).toFixed(2)})`,
      details: { token, amountHuman, amountUsd: amountUsd ?? amountHuman, relayId: deposit.relayId },
      privacy: "public",
    });

    res.json({
      relayId: deposit.relayId,
      to: deposit.to,
      calldata: deposit.calldata,
      value: deposit.value?.toString() ?? "0",
      memberId: member.id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deposit confirm
app.post("/api/treasury/deposit/confirm", async (req, res) => {
  try {
    const { relayId } = req.body;
    if (!relayId) {
      res.status(400).json({ error: "Missing relayId" });
      return;
    }
    if (unlink) {
      await unlink.confirmDeposit(relayId);
    }
    confirmDepositDb(relayId);

    logActivity({
      eventType: "deposit_confirmed",
      summary: `Deposit confirmed on-chain`,
      details: { relayId },
      privacy: "public",
    });

    res.json({ confirmed: true, relayId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[${AGENT_NAME}] Ghost Treasury agent running on http://localhost:${PORT}`);
  console.log(`[${AGENT_NAME}] Chat endpoint: POST http://localhost:${PORT}/api/agent/chat`);
  startStrategyLoop(toolCtx);
});
