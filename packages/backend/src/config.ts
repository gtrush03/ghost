import { defineChain, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { initUnlink, createSqliteStorage } from "@unlink-xyz/node";
import {
  CHAIN_ID,
  RPC_URL,
  EXPLORER_URL,
  USDC_ADDRESS,
  WMON_ADDRESS,
  NATIVE_MON,
  UNLINK_POOL,
  UNLINK_GATEWAY,
  X402_FACILITATOR,
  X402_NETWORK_ID,
} from "@ghost/shared";

export const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "MonadScan", url: EXPLORER_URL },
  },
  testnet: true,
});

export function createAgentClients(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const transport = http(RPC_URL);

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport,
  });

  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport,
  });

  return { account, publicClient, walletClient };
}

export async function createAgentWallet(name: string) {
  // Use CLI-compatible data dir so `unlink-cli` and backend share the same wallet
  const dataDir = `./data/${name}-cli`;
  const unlink = await initUnlink({
    chain: "monad-testnet",
    storage: createSqliteStorage({ path: `${dataDir}/wallet.db` }),
  });
  return unlink;
}

export async function getUnlinkAddress(unlink: Awaited<ReturnType<typeof initUnlink>>) {
  const active = await unlink.sdk.accounts.getActive();
  return active.address as string;
}

// Re-export shared constants for convenience
export {
  CHAIN_ID,
  RPC_URL,
  EXPLORER_URL,
  USDC_ADDRESS,
  WMON_ADDRESS,
  NATIVE_MON,
  UNLINK_POOL,
  UNLINK_GATEWAY,
  X402_FACILITATOR,
  X402_NETWORK_ID,
};
