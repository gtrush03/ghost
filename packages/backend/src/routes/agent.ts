import { Router } from "express";
import type { ToolContext } from "../agent/tools.js";
import { executeSwapDirect, executeSettingsDirect, executeWithdrawalDirect, executeStrategyRuleDirect } from "../agent/tools.js";
import { runAgent } from "../agent/core.js";
import type { AgentEvent, AgentMessage } from "@ghost/shared";
import { optionalAuth, requireAuth } from "./auth.js";
import { consumeAction } from "../agent/actions.js";

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MS = 500; // minimum gap between requests per IP

export function createAgentRouter(toolCtx: ToolContext): Router {
  const router = Router();

  // Per-user conversation history (keyed by wallet or __anonymous__)
  const historyMap: Map<string, AgentMessage[]> = new Map();

  function getHistory(wallet?: string): AgentMessage[] {
    const key = wallet ?? "__anonymous__";
    if (!historyMap.has(key)) historyMap.set(key, []);
    return historyMap.get(key)!;
  }

  // Simple rate limiter
  const lastRequest: Map<string, number> = new Map();

  router.post("/chat", optionalAuth, async (req, res) => {
    // Rate limit
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const last = lastRequest.get(ip) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      return res.status(429).json({ error: "Rate limited. Try again in a moment." });
    }
    lastRequest.set(ip, now);

    const { message } = req.body;
    // Use verified wallet from auth middleware, fall back to body wallet for backwards compat
    const wallet = (req as any).verifiedWallet ?? req.body.wallet;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` });
    }

    const sanitized = message.trim();
    if (sanitized.length === 0) {
      return res.status(400).json({ error: "message is required" });
    }

    console.log(`[agent] User${wallet ? ` (${wallet})` : ""}: ${sanitized}`);

    // Create per-request context with caller wallet (avoids race conditions)
    const requestCtx: ToolContext = {
      ...toolCtx,
      callerWallet: typeof wallet === "string" ? wallet : undefined,
    };

    const history = getHistory(wallet);
    history.push({
      role: "user",
      content: sanitized,
      timestamp: new Date().toISOString(),
    });

    const events: AgentEvent[] = [];
    const toolCalls: Array<{ name: string; input: Record<string, unknown>; result?: unknown }> = [];
    let responseText = "";

    try {
      for await (const event of runAgent(sanitized, requestCtx)) {
        events.push(event);

        switch (event.type) {
          case "text":
            responseText += event.text ?? "";
            break;
          case "tool_call":
            toolCalls.push({ name: event.name!, input: event.input ?? {} });
            break;
          case "tool_result": {
            const lastCall = toolCalls[toolCalls.length - 1];
            if (lastCall && lastCall.name === event.name) {
              lastCall.result = event.result;
            }
            break;
          }
          case "error":
            console.error(`[agent] Error: ${event.error}`);
            break;
        }
      }
    } catch (error: any) {
      console.error("[agent] Fatal error:", error.message);
      return res.status(500).json({ error: "Agent error", detail: error.message });
    }

    history.push({
      role: "assistant",
      content: responseText,
      timestamp: new Date().toISOString(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });

    console.log(`[agent] Ghost: ${responseText.slice(0, 120)}...`);

    return res.json({
      response: responseText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      events,
    });
  });

  // POST /api/agent/confirm — confirm or reject a pending action
  router.post("/confirm", requireAuth, async (req, res) => {
    const { actionId, approved } = req.body;
    const wallet = (req as any).verifiedWallet;

    if (!actionId || typeof actionId !== "string") {
      return res.status(400).json({ error: "actionId is required" });
    }

    if (typeof approved !== "boolean") {
      return res.status(400).json({ error: "approved must be a boolean" });
    }

    if (!approved) {
      // User rejected — just consume and discard
      consumeAction(actionId, wallet);
      return res.json({ rejected: true, actionId });
    }

    // User approved — consume and execute
    const action = consumeAction(actionId, wallet);
    if (!action) {
      return res.status(404).json({ error: "Action not found, expired, or wallet mismatch" });
    }

    const requestCtx: ToolContext = {
      ...toolCtx,
      callerWallet: wallet,
    };

    let result: unknown;
    switch (action.type) {
      case "swap":
        result = await executeSwapDirect(action.params, requestCtx);
        break;
      case "settings":
        result = executeSettingsDirect(action.params, requestCtx);
        break;
      case "withdrawal":
        result = await executeWithdrawalDirect(action.params, requestCtx);
        break;
      case "strategy_rule":
        result = executeStrategyRuleDirect(action.params, requestCtx);
        break;
      default:
        return res.status(400).json({ error: `Unknown action type: ${action.type}` });
    }

    return res.json({ confirmed: true, actionId, result });
  });

  router.get("/history", optionalAuth, (_req, res) => {
    const wallet = (_req as any).verifiedWallet;
    const history = getHistory(wallet);
    res.json({ messages: history });
  });

  router.post("/clear", optionalAuth, (_req, res) => {
    const wallet = (_req as any).verifiedWallet;
    const key = wallet ?? "__anonymous__";
    historyMap.delete(key);
    res.json({ cleared: true });
  });

  return router;
}
