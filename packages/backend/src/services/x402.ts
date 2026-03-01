import { USDC_ADDRESS, X402_FACILITATOR, X402_NETWORK_ID } from "@ghost/shared";
import type { PriceData } from "@ghost/shared";

// x402 price feed server setup (for trading agent)
export function createX402PriceRoutes(payToAddress: string) {
  // Returns route config + handlers for the x402-gated price feed
  return {
    routeConfig: {
      "GET /price/eth": {
        accepts: {
          scheme: "exact",
          network: X402_NETWORK_ID,
          payTo: payToAddress,
          price: "$0.001",
          maxTimeoutSeconds: 60,
        },
        description: "Real-time ETH price feed",
      },
      "GET /price/mon": {
        accepts: {
          scheme: "exact",
          network: X402_NETWORK_ID,
          payTo: payToAddress,
          price: "$0.001",
          maxTimeoutSeconds: 60,
        },
        description: "Real-time MON price feed",
      },
      "GET /price/usdc": {
        accepts: {
          scheme: "exact",
          network: X402_NETWORK_ID,
          payTo: payToAddress,
          price: "$0.001",
          maxTimeoutSeconds: 60,
        },
        description: "USDC price (stablecoin peg check)",
      },
    },
    handlers: {
      eth: (_req: any, res: any) => {
        const price = 3847.5 + (Math.random() - 0.5) * 100;
        res.json({ asset: "ETH", price: Math.round(price * 100) / 100, timestamp: new Date().toISOString(), source: "x402-ghost" });
      },
      mon: (_req: any, res: any) => {
        const price = 0.42 + (Math.random() - 0.5) * 0.05;
        res.json({ asset: "MON", price: Math.round(price * 10000) / 10000, timestamp: new Date().toISOString(), source: "x402-ghost" });
      },
      usdc: (_req: any, res: any) => {
        res.json({ asset: "USDC", price: 1.0, timestamp: new Date().toISOString(), source: "x402-ghost" });
      },
    },
  };
}

// x402 price feed client (for treasury agent to buy prices)
export async function fetchPrice(asset: string, priceFeedUrl: string, burnerKey?: string): Promise<PriceData> {
  const assetLower = asset.toLowerCase();
  const url = `${priceFeedUrl}/price/${assetLower}`;

  try {
    if (burnerKey) {
      // Full x402 payment flow
      const { wrapFetchWithPayment } = await import("@x402/fetch");
      const { x402Client } = await import("@x402/core/client");
      const { ExactEvmScheme } = await import("@x402/evm/exact/client");
      const { toClientEvmSigner } = await import("@x402/evm");
      const { privateKeyToAccount } = await import("viem/accounts");
      const { createPublicClient, http } = await import("viem");
      const { monadTestnet } = await import("../config.js");

      const account = privateKeyToAccount(burnerKey as `0x${string}`);
      const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
      const signer = toClientEvmSigner(account, publicClient);

      const client = new x402Client();
      client.register(X402_NETWORK_ID, new ExactEvmScheme(signer));
      const payFetch = wrapFetchWithPayment(fetch, client);

      const res = await payFetch(url);
      if (!res.ok) throw new Error(`x402 payment failed: ${res.status}`);
      return await res.json() as PriceData;
    }

    // Fallback: direct fetch (no payment, works if price feed doesn't require x402)
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Price feed returned ${res.status}`);
    return await res.json() as PriceData;
  } catch (error) {
    // Demo fallback prices
    const demoPrices: Record<string, number> = { eth: 3847.5, mon: 0.42, usdc: 1.0 };
    return {
      asset: asset.toUpperCase(),
      price: demoPrices[assetLower] ?? 0,
      timestamp: new Date().toISOString(),
      source: "demo-fallback",
    };
  }
}
