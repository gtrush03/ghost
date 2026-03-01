import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import express from "express";
import cors from "cors";
import { createAgentClients, createAgentWallet, getUnlinkAddress } from "./config.js";

const PORT = 3001;
const AGENT_NAME = "research";

const key = process.env.RESEARCH_AGENT_KEY as `0x${string}`;
if (!key) throw new Error("RESEARCH_AGENT_KEY not set in .env");

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
    status: "idle",
    publicAddress: account.address,
    unlinkAddress,
  });
});

app.listen(PORT, () => {
  console.log(`[${AGENT_NAME}] Agent running on http://localhost:${PORT}`);
});
