import { Router, type Request, type Response, type NextFunction } from "express";
import { generateSiweNonce, verifySiweMessage } from "viem/siwe";
import { createPublicClient, http } from "viem";
import { randomUUID } from "crypto";

const RPC_URL = process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const publicClient = createPublicClient({ transport: http(RPC_URL) });

// Nonce store with 5min TTL
const nonceStore: Map<string, { nonce: string; expires: number }> = new Map();

// Session store with 24h TTL
const sessionStore: Map<string, { wallet: string; expires: number }> = new Map();

const NONCE_TTL = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function cleanupExpired() {
  const now = Date.now();
  for (const [key, val] of nonceStore) {
    if (val.expires < now) nonceStore.delete(key);
  }
  for (const [key, val] of sessionStore) {
    if (val.expires < now) sessionStore.delete(key);
  }
}

export function createAuthRouter(): Router {
  const router = Router();

  // GET /nonce — generate random nonce for SIWE
  router.get("/nonce", (_req: Request, res: Response) => {
    cleanupExpired();
    const nonce = generateSiweNonce();
    const id = randomUUID();
    nonceStore.set(id, { nonce, expires: Date.now() + NONCE_TTL });
    res.json({ nonceId: id, nonce });
  });

  // POST /verify — verify SIWE signature, issue session token
  router.post("/verify", async (req: Request, res: Response) => {
    cleanupExpired();
    const { message, signature, nonceId } = req.body;

    if (!message || !signature || !nonceId) {
      res.status(400).json({ error: "Missing message, signature, or nonceId" });
      return;
    }

    // Validate nonce
    const stored = nonceStore.get(nonceId);
    if (!stored) {
      res.status(400).json({ error: "Invalid or expired nonce" });
      return;
    }
    nonceStore.delete(nonceId);

    try {
      const valid = await verifySiweMessage(publicClient, {
        message,
        signature: signature as `0x${string}`,
      });

      if (!valid) {
        res.status(401).json({ error: "Invalid SIWE signature" });
        return;
      }

      // Extract wallet address from the SIWE message
      const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
      if (!addressMatch) {
        res.status(400).json({ error: "Could not extract address from SIWE message" });
        return;
      }

      const wallet = addressMatch[0].toLowerCase();
      const token = randomUUID();
      sessionStore.set(token, { wallet, expires: Date.now() + SESSION_TTL });

      res.json({ token, wallet });
    } catch (error: any) {
      res.status(401).json({ error: `Verification failed: ${error.message}` });
    }
  });

  return router;
}

// Middleware: require authenticated session
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const session = sessionStore.get(token);

  if (!session || session.expires < Date.now()) {
    sessionStore.delete(token);
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  (req as any).verifiedWallet = session.wallet;
  next();
}

// Middleware: optional authentication (doesn't reject, just attaches wallet if valid)
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const session = sessionStore.get(token);
    if (session && session.expires >= Date.now()) {
      (req as any).verifiedWallet = session.wallet;
    }
  }
  next();
}
