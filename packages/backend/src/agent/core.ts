import type { AgentEvent } from "@ghost/shared";
import type { ToolContext } from "./tools.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import { streamDemoResponse, isDemoMode } from "../services/demo.js";
import { getConstraints } from "./validator.js";
import * as dbService from "../services/db.js";

function buildSystemPrompt(ctx: ToolContext): string {
  const constraints = getConstraints();

  // Caller context
  let callerSection = "";
  if (ctx.callerWallet) {
    const member = dbService.getMember(ctx.callerWallet);
    if (member) {
      const power = dbService.getVotingPower(ctx.callerWallet);
      callerSection = `
CURRENT CALLER:
- Wallet: ${ctx.callerWallet}
- Display name: ${member.displayName ?? "not set"}
- Voting power: ${(power * 100).toFixed(1)}% ${power >= 0.51 ? "(can change settings)" : "(cannot change settings alone — need 51%)"}
- Member since: ${member.joinedAt}`;
    } else {
      callerSection = `
CURRENT CALLER:
- Wallet: ${ctx.callerWallet}
- Status: Not a registered member yet. They can register by depositing or via the register endpoint.`;
    }
  }

  // Pool stats
  let poolSection = "";
  try {
    const stats = dbService.getPoolStats();
    poolSection = `
POOL STATUS:
- Active members: ${stats.activeMembers}
- Total deposited: $${stats.totalDepositedUsd.toFixed(2)}
- Net pool value (tracked): $${stats.netPoolUsd.toFixed(2)}`;
  } catch {
    // DB not initialized yet
  }

  return `You are Ghost, a private treasury manager for a DAO on Monad.

You manage funds inside an Unlink privacy pool. Your job is to execute the members' investment strategy while keeping all activity private from on-chain observers.
${callerSection}
${poolSection}

CONSTRAINTS (enforced by smart contract — you cannot override these):
- Maximum single trade: ${constraints.maxTradePct}% of treasury value
- Allowed tokens: USDC, WMON/ETH, MON
- Minimum time between trades: ${constraints.cooldownMinutes} minutes
- ${constraints.paused ? "PAUSED by member vote — no trades can execute" : "Active — trades are enabled"}

GOVERNANCE:
- Settings changes require >= 51% voting power
- Voting power = your net deposits / total pool value
- Use update_settings tool to change maxTradePct, cooldownMinutes, or paused
- Use get_members tool to see all members and their voting power

TOOLS:
- check_balance: See current treasury holdings via the privacy pool
- get_price: Buy real-time price data via x402 micropayment ($0.001 per request from burner account)
- execute_swap: Execute a private swap via DeFi adapter (atomic unshield-swap-reshield)
- generate_report: Create a summary report for members
- update_settings: Change a governance setting (requires 51% voting power)
- get_members: List all pool members with shares and voting power

RULES:
1. Always check constraints before trading
2. Explain your reasoning to members in plain English
3. If a trade would violate constraints, explain why and suggest an alternative
4. Never reveal private keys, viewing keys, or internal wallet addresses
5. When in doubt, do NOT trade — preserving capital is the priority
6. When asked about privacy, explain the Unlink ZK privacy model clearly
7. Be concise but thorough
8. When a member asks to change settings, check their voting power first

PRIVACY MODEL:
- Deposits: Amount and token visible, depositor identity private
- Transfers: Everything private (amount, sender, recipient, token)
- Withdrawals: Amount and token visible, source private
- DeFi trades: Fully private via atomic unshield-swap-reshield
- Viewing keys: Only shared with authorized members and auditors

When rejecting a trade, always mention the specific constraint limit (e.g. ${constraints.maxTradePct}%) and explain the three safety layers: your own check, the app validator, and the on-chain GhostVault contract.

When discussing who can see the strategy, always mention viewing keys, MEV protection, and compliant privacy.`;
}

const MAX_TOOL_ROUNDS = 5;
const LLM_TIMEOUT_MS = 30_000;

interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export async function* runAgent(
  userMessage: string,
  toolCtx: ToolContext
): AsyncGenerator<AgentEvent> {
  // Demo mode — instant cached responses
  if (isDemoMode()) {
    yield* streamDemoResponse(userMessage);
    return;
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    console.warn("[agent] No OPENROUTER_API_KEY — falling back to demo mode");
    yield* streamDemoResponse(userMessage);
    return;
  }

  const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-6";

  const systemPrompt = buildSystemPrompt(toolCtx);

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: any;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ghost-treasury.xyz",
          "X-Title": "Ghost Treasury",
        },
        body: JSON.stringify({
          model,
          messages,
          tools: TOOL_DEFINITIONS,
          tool_choice: "auto",
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[agent] OpenRouter ${res.status}: ${errText}`);
        yield { type: "error", error: `LLM error: ${res.status}` };
        yield* streamDemoResponse(userMessage);
        return;
      }

      response = await res.json();
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.error("[agent] LLM request timed out after", LLM_TIMEOUT_MS, "ms");
      } else {
        console.error("[agent] LLM request failed:", error.message);
      }
      yield* streamDemoResponse(userMessage);
      return;
    }

    const choice = response.choices?.[0];
    if (!choice) {
      yield { type: "error", error: "Empty response from LLM" };
      return;
    }

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (assistantMessage.content) {
      yield { type: "text", text: assistantMessage.content };
    }

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0 || choice.finish_reason === "stop") {
      yield { type: "done" };
      return;
    }

    // Execute each tool call
    for (const tc of toolCalls) {
      const fnName = tc.function.name;
      let fnArgs: Record<string, unknown> = {};
      try {
        fnArgs = JSON.parse(tc.function.arguments || "{}");
      } catch {
        fnArgs = {};
      }

      yield { type: "tool_call", name: fnName, input: fnArgs };
      const result = await executeTool(fnName, fnArgs, toolCtx);
      yield { type: "tool_result", name: fnName, result };

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  yield { type: "text", text: "Reached maximum tool rounds. Please try a simpler request." };
  yield { type: "done" };
}
