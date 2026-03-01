import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import { parseEther, formatEther } from "viem";
import { createAgentClients } from "./config.js";

const treasuryKey = process.env.TREASURY_AGENT_KEY as `0x${string}`;
const researchAddr = "0x8E272ACe9ae8f0bA7743EbC716AcE3bbBb2408bB" as const;
const tradingAddr = "0x23Ffb7dD833B2E933C08a2A0aeADB6E364063ea6" as const;

if (!treasuryKey) throw new Error("TREASURY_AGENT_KEY not set");

const { account, walletClient, publicClient } = createAgentClients(treasuryKey);

console.log("Treasury agent:", account.address);
const balance = await publicClient.getBalance({ address: account.address });
console.log(`Treasury balance: ${formatEther(balance)} MON`);

// Get current nonce and manage locally (Monad nonce gotcha)
let nonce = await publicClient.getTransactionCount({ address: account.address });
console.log(`Current nonce: ${nonce}`);

const sendAmount = parseEther("30"); // 30 MON each

// Check if Research already has funds (TX1 succeeded earlier)
const researchBefore = await publicClient.getBalance({ address: researchAddr });
if (researchBefore > 0n) {
  console.log(`\nResearch already funded: ${formatEther(researchBefore)} MON — skipping`);
} else {
  console.log(`\nSending 30 MON to Research (${researchAddr})...`);
  const tx1 = await walletClient.sendTransaction({
    to: researchAddr,
    value: sendAmount,
    nonce: nonce++,
  });
  console.log(`  TX: ${tx1}`);
  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash: tx1 });
  console.log(`  Confirmed!`);
}

console.log(`Sending 30 MON to Trading (${tradingAddr})...`);
// Refresh nonce after waiting
nonce = await publicClient.getTransactionCount({ address: account.address });
const tx2 = await walletClient.sendTransaction({
  to: tradingAddr,
  value: sendAmount,
  nonce: nonce,
});
console.log(`  TX: ${tx2}`);
await publicClient.waitForTransactionReceipt({ hash: tx2 });
console.log(`  Confirmed!`);

// Check final balances
const [treasuryBal, researchBal, tradingBal] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.getBalance({ address: researchAddr }),
  publicClient.getBalance({ address: tradingAddr }),
]);

console.log(`\n=== Final Balances ===`);
console.log(`Treasury: ${formatEther(treasuryBal)} MON`);
console.log(`Research: ${formatEther(researchBal)} MON`);
console.log(`Trading:  ${formatEther(tradingBal)} MON`);
console.log(`\nAll agents funded!`);
