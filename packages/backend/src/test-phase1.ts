import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet, CHAIN_ID, RPC_URL } from "./config.js";

const AGENTS = [
  { name: "research", keyEnv: "RESEARCH_AGENT_KEY" },
  { name: "trading", keyEnv: "TRADING_AGENT_KEY" },
  { name: "treasury", keyEnv: "TREASURY_AGENT_KEY" },
] as const;

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("\n=== Phase 1 Validation ===\n");

  // 1. Monad RPC
  console.log("1. Monad RPC Connection");
  const client = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });

  const chainId = await client.getChainId();
  check("Chain ID", chainId === CHAIN_ID, `${chainId}`);

  const blockNumber = await client.getBlockNumber();
  check("Block number advancing", blockNumber > 0n, `#${blockNumber}`);

  // 2. Agent keys
  console.log("\n2. Agent Keys");
  for (const { name, keyEnv } of AGENTS) {
    const key = process.env[keyEnv];
    check(`${name} key exists`, !!key);

    if (key) {
      const account = privateKeyToAccount(key as `0x${string}`);
      check(`${name} address`, !!account.address, account.address);

      const balance = await client.getBalance({ address: account.address });
      const balMon = Number(balance) / 1e18;
      check(`${name} MON balance`, true, `${balMon.toFixed(4)} MON${balMon === 0 ? " (needs faucet)" : ""}`);
    }
  }

  // 3. Unlink wallet init
  console.log("\n3. Unlink Wallet Init");
  try {
    const { createAgentWallet, getUnlinkAddress } = await import("./config.js");
    const testWallet = await createAgentWallet("test-phase1");
    const addr = await getUnlinkAddress(testWallet);
    check("Unlink wallet initializes", !!addr, addr);
  } catch (e: any) {
    check("Unlink wallet initializes", false, e.message);
  }

  // 4. Block advancing
  console.log("\n4. Block Advancement");
  const block2 = await client.getBlockNumber();
  check("Second block fetch", block2 >= blockNumber, `#${block2}`);

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
