import { createPublicClient, http, formatEther } from "viem";
import { RPC_URL, CHAIN_ID } from "@ghost/shared";
import { monadTestnet } from "../config.js";

export class NonceManager {
  private nonces: Map<string, number> = new Map();

  async getNonce(address: string): Promise<number> {
    if (!this.nonces.has(address)) {
      const client = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });
      const n = await client.getTransactionCount({ address: address as `0x${string}` });
      this.nonces.set(address, n);
    }
    const nonce = this.nonces.get(address)!;
    this.nonces.set(address, nonce + 1);
    return nonce;
  }

  reset(address: string) {
    this.nonces.delete(address);
  }
}

export async function getPublicBalance(address: string): Promise<string> {
  const client = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });
  const balance = await client.getBalance({ address: address as `0x${string}` });
  return formatEther(balance);
}

export async function sendRawTransactionSync(signedTx: string): Promise<any> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_sendRawTransactionSync",
      params: [signedTx],
      id: 1,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`TX failed: ${data.error.message}`);
  return data.result;
}

export const nonceManager = new NonceManager();
