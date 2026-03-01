import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import express from "express";
import cors from "cors";
import { createAgentClients, createAgentWallet, getUnlinkAddress } from "./config.js";
import { createUnlinkService } from "./services/unlink.js";
import { createAgentRouter } from "./routes/agent.js";
import { createMembersRouter } from "./routes/members.js";
import { createSettingsRouter } from "./routes/settings.js";
import { toolCheckBalance, type ToolContext } from "./agent/tools.js";
import { initDatabase, ensureMember, createDeposit, confirmDeposit as confirmDepositDb } from "./services/db.js";
import { loadConstraints } from "./agent/validator.js";

const PORT = 3003;
const AGENT_NAME = "treasury";

const key = process.env.TREASURY_AGENT_KEY as `0x${string}`;
if (!key) throw new Error("TREASURY_AGENT_KEY not set in .env");

const { account } = createAgentClients(key);
console.log(`[${AGENT_NAME}] Public address: ${account.address}`);

const unlink = await createAgentWallet(AGENT_NAME);
const unlinkAddress = await getUnlinkAddress(unlink);
console.log(`[${AGENT_NAME}] Unlink address: ${unlinkAddress}`);

// Phase 2: Initialize agent services
const unlinkService = createUnlinkService(unlink);

// Initialize DAO database
const db = initDatabase();
loadConstraints(db);
console.log(`[${AGENT_NAME}] SQLite DB initialized`);

// Price feed URL (trading agent or external)
const priceFeedUrl = process.env.PRICE_FEED_URL ?? "http://localhost:3002";

// Tool context for the agent brain
const toolCtx: ToolContext = {
  unlinkService,
  priceFeedUrl,
  burnerKey: undefined, // Will be set when burner is funded
  db,
};

// Fund burner account for x402 micropayments (non-blocking)
async function initBurner() {
  try {
    const burnerAddr = await unlinkService.getBurnerAddress(0);
    console.log(`[${AGENT_NAME}] Burner address: ${burnerAddr}`);

    const burnerKey = await unlinkService.getBurnerKey(0);
    toolCtx.burnerKey = burnerKey;
    console.log(`[${AGENT_NAME}] Burner key loaded`);
  } catch (error: any) {
    console.log(`[${AGENT_NAME}] Burner not funded yet: ${error.message}`);
    console.log(`[${AGENT_NAME}] x402 payments will use demo fallback`);
  }
}
initBurner();

console.log(`[${AGENT_NAME}] Agent brain: ${process.env.OPENROUTER_API_KEY ? "OpenRouter" : "Demo Mode"}`);
console.log(`[${AGENT_NAME}] Price feed: ${priceFeedUrl}`);

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    agent: AGENT_NAME,
    status: "ready",
    phase: 2,
    publicAddress: account.address,
    unlinkAddress,
    brain: process.env.OPENROUTER_API_KEY ? "openrouter" : "demo",
    model: process.env.OPENROUTER_MODEL ?? "demo-mode",
  });
});

// Treasury state — reuses toolCheckBalance for formatted symbols + USD values
app.get("/api/treasury/state", async (_req, res) => {
  try {
    const result = await toolCheckBalance(toolCtx);
    res.json({
      ...(result as object),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    res.json({ balances: {}, totalValueUsd: 0, privacyStatus: "unknown", error: error.message });
  }
});

// Agent chat routes (POST /api/agent/chat, GET /api/agent/history)
app.use("/api/agent", createAgentRouter(toolCtx));

// DAO routes
app.use("/api/members", createMembersRouter());
app.use("/api/treasury/settings", createSettingsRouter());

// POST /api/treasury/deposit — generate deposit calldata
app.post("/api/treasury/deposit", async (req, res) => {
  try {
    const { depositor, token, amount, amountUsd } = req.body;
    if (!depositor || !token || !amount) {
      res.status(400).json({ error: "Missing depositor, token, or amount" });
      return;
    }

    // Register or get member
    const member = ensureMember(depositor);

    const deposit = await unlink.deposit({
      depositor,
      deposits: [{ token, amount: BigInt(amount) }],
    });

    // Track deposit in DB
    const amountNum = Number(amount);
    const decimals = token.toLowerCase() === "0x534b2f3a21130d7a60830c2df862319e593943a3" ? 6 : 18;
    const amountHuman = amountNum / 10 ** decimals;
    createDeposit({
      memberId: member.id,
      tokenAddress: token,
      amountRaw: amount.toString(),
      amountHuman,
      amountUsd: amountUsd ?? amountHuman, // Use provided USD value or fall back to human amount
      relayId: deposit.relayId,
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

// POST /api/treasury/deposit/confirm — confirm after on-chain tx
app.post("/api/treasury/deposit/confirm", async (req, res) => {
  try {
    const { relayId } = req.body;
    if (!relayId) {
      res.status(400).json({ error: "Missing relayId" });
      return;
    }
    await unlink.confirmDeposit(relayId);
    confirmDepositDb(relayId);
    res.json({ confirmed: true, relayId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[${AGENT_NAME}] Ghost Treasury agent running on http://localhost:${PORT}`);
  console.log(`[${AGENT_NAME}] Chat endpoint: POST http://localhost:${PORT}/api/agent/chat`);
});
