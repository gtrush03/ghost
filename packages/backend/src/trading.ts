import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import express from "express";
import cors from "cors";
import { createAgentClients, createAgentWallet, getUnlinkAddress } from "./config.js";
import { createX402PriceRoutes } from "./services/x402.js";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { USDC_ADDRESS, X402_FACILITATOR, X402_NETWORK_ID } from "@ghost/shared";

const PORT = 3002;
const AGENT_NAME = "trading";

const key = process.env.TRADING_AGENT_KEY as `0x${string}`;
if (!key) throw new Error("TRADING_AGENT_KEY not set in .env");

const { account } = createAgentClients(key);
console.log(`[${AGENT_NAME}] Public address: ${account.address}`);

const unlink = await createAgentWallet(AGENT_NAME);
const unlinkAddress = await getUnlinkAddress(unlink);
console.log(`[${AGENT_NAME}] Unlink address: ${unlinkAddress}`);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    agent: AGENT_NAME,
    status: "ready",
    phase: 2,
    publicAddress: account.address,
    unlinkAddress,
    services: ["price-feed"],
  });
});

// Phase 2: x402 price feed endpoints with payment gating
const priceRoutes = createX402PriceRoutes(account.address);

// x402 server-side payment gating
const facilitator = new HTTPFacilitatorClient({ url: X402_FACILITATOR });
const x402Server = new x402ResourceServer(facilitator);
const evmScheme = new ExactEvmScheme();

// CRITICAL: Monad is NOT in the default stablecoin map — must register!
evmScheme.registerMoneyParser(async (amount: number, network: string) => {
  if (network === X402_NETWORK_ID) {
    return {
      amount: Math.round(amount * 1e6).toString(),
      asset: USDC_ADDRESS,
      extra: { name: "USDC", version: "2" },
    };
  }
  return null;
});
x402Server.register(X402_NETWORK_ID, evmScheme);

// Apply x402 payment middleware BEFORE price routes
app.use(paymentMiddleware(priceRoutes.routeConfig as any, x402Server));

app.get("/price/eth", priceRoutes.handlers.eth);
app.get("/price/mon", priceRoutes.handlers.mon);
app.get("/price/usdc", priceRoutes.handlers.usdc);

// x402 route config (for when we add payment middleware)
app.get("/api/price-config", (_req, res) => {
  res.json(priceRoutes.routeConfig);
});

app.listen(PORT, () => {
  console.log(`[${AGENT_NAME}] Trading agent + price feed on http://localhost:${PORT}`);
  console.log(`[${AGENT_NAME}] Price endpoints: /price/eth, /price/mon, /price/usdc`);
});
