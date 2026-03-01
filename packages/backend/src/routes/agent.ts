import { Router } from "express";
import type { ToolContext } from "../agent/tools.js";
import { runAgent } from "../agent/core.js";
import type { AgentEvent, AgentMessage } from "@ghost/shared";

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MS = 500; // minimum gap between requests per IP

export function createAgentRouter(toolCtx: ToolContext): Router {
  const router = Router();

  // Conversation history (in-memory for demo)
  const history: AgentMessage[] = [];

  // Simple rate limiter
  const lastRequest: Map<string, number> = new Map();

  router.post("/chat", async (req, res) => {
    // Rate limit
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const last = lastRequest.get(ip) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      return res.status(429).json({ error: "Rate limited. Try again in a moment." });
    }
    lastRequest.set(ip, now);

    const { message, wallet } = req.body;

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

  router.get("/history", (_req, res) => {
    res.json({ messages: history });
  });

  router.post("/clear", (_req, res) => {
    history.length = 0;
    res.json({ cleared: true });
  });

  return router;
}
