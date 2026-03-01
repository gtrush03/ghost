import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

// Phase 2 Integration Test
// Works with both demo mode AND live LLM mode
// Assertions check semantic content, not exact demo strings

const TREASURY_URL = "http://localhost:3003";
const TRADING_URL = "http://localhost:3002";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error: any) {
    failed++;
    console.log(`  FAIL  ${name}: ${error.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function responseContainsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postChat(message: string): Promise<any> {
  await sleep(800); // avoid rate limiter between sequential calls
  const res = await fetch(`${TREASURY_URL}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  assert(res.ok, `Chat returned ${res.status}`);
  return res.json();
}

async function main() {
  const isDemo = process.env.DEMO_MODE === "true";
  console.log(`\n=== Ghost Treasury — Phase 2 Integration Test (${isDemo ? "DEMO" : "LIVE LLM"} mode) ===\n`);

  // --- Health checks ---

  await test("Treasury agent health", async () => {
    const res = await fetch(`${TREASURY_URL}/health`);
    const data = await res.json();
    assert(data.agent === "treasury", "wrong agent name");
    assert(data.status === "ready", "not ready");
    assert(data.phase === 2, "not phase 2");
    if (!isDemo) {
      assert(data.brain === "openrouter", "expected openrouter brain");
    }
  });

  await test("Trading agent health", async () => {
    const res = await fetch(`${TRADING_URL}/health`);
    const data = await res.json();
    assert(data.agent === "trading", "wrong agent name");
    assert(data.services.includes("price-feed"), "no price-feed service");
  });

  // --- Price feeds ---

  await test("ETH price feed", async () => {
    const res = await fetch(`${TRADING_URL}/price/eth`);
    const data = await res.json();
    assert(data.asset === "ETH", "wrong asset");
    assert(typeof data.price === "number" && data.price > 0, "invalid price");
    assert(data.source === "x402-ghost", "wrong source");
  });

  await test("MON price feed", async () => {
    const res = await fetch(`${TRADING_URL}/price/mon`);
    const data = await res.json();
    assert(data.asset === "MON", "wrong asset");
    assert(typeof data.price === "number" && data.price > 0, "invalid price");
  });

  await test("USDC price feed", async () => {
    const res = await fetch(`${TRADING_URL}/price/usdc`);
    const data = await res.json();
    assert(data.asset === "USDC", "wrong asset");
    assert(data.price === 1, "USDC not pegged");
  });

  // --- Agent chat: Clear history first ---
  await fetch(`${TREASURY_URL}/api/agent/clear`, { method: "POST" });

  // --- Demo 1: Position ---
  await test("Agent: Position check", async () => {
    const data = await postChat("What's our position?");
    assert(data.response.length > 20, "response too short");
    assert(
      responseContainsAny(data.response, ["USDC", "treasury", "balance", "position", "hold"]),
      "missing treasury context"
    );
    // Should call check_balance tool
    assert(
      data.toolCalls?.some((t: any) => t.name === "check_balance"),
      "missing check_balance tool call"
    );
  });

  // --- Demo 2: Rebalance ---
  await test("Agent: Rebalance trade", async () => {
    const data = await postChat("Rebalance to 60/40 ETH/USDC");
    assert(data.response.length > 20, "response too short");
    assert(
      responseContainsAny(data.response, ["rebalance", "swap", "ETH", "USDC", "execut", "trade", "allocat"]),
      "not a rebalance response"
    );
    // Should call get_price
    assert(
      data.toolCalls?.some((t: any) => t.name === "get_price" || t.name === "check_balance"),
      "missing price or balance tool call"
    );
  });

  // --- Demo 3: Block explorer ---
  await test("Agent: Block explorer", async () => {
    const data = await postChat("Show me on the block explorer");
    assert(data.response.length > 20, "response too short");
    assert(
      responseContainsAny(data.response, ["explorer", "monadscan", "block", "private", "invisible", "cannot", "hidden"]),
      "missing explorer/privacy context"
    );
  });

  // --- Demo 4: Rejection ---
  await test("Agent: Constraint rejection", async () => {
    const data = await postChat("Swap 100% to memecoin");
    assert(data.response.length > 20, "response too short");
    assert(
      responseContainsAny(data.response, ["reject", "cannot", "constraint", "limit", "10%", "not allowed", "violat", "exceed", "safety"]),
      "not a rejection response"
    );
  });

  // --- Demo 5: Privacy ---
  await test("Agent: Privacy explanation", async () => {
    const data = await postChat("Who can see our strategy?");
    assert(data.response.length > 50, "response too short");
    assert(
      responseContainsAny(data.response, ["viewing key", "private", "privacy", "MEV", "compliant"]),
      "missing privacy details"
    );
  });

  // --- Chat history ---
  await test("Chat history tracks messages", async () => {
    const res = await fetch(`${TREASURY_URL}/api/agent/history`);
    const data = await res.json();
    assert(data.messages.length >= 10, `expected >= 10 messages, got ${data.messages.length}`);
    assert(data.messages.some((m: any) => m.role === "user"), "no user messages");
    assert(data.messages.some((m: any) => m.role === "assistant"), "no assistant messages");
  });

  // --- Treasury state ---
  await test("Treasury state endpoint", async () => {
    const res = await fetch(`${TREASURY_URL}/api/treasury/state`);
    const data = await res.json();
    assert(data.privacyStatus !== undefined, "missing privacy status");
    assert(data.lastUpdated !== undefined, "missing timestamp");
  });

  // --- Error handling ---
  await sleep(800);
  await test("Chat rejects empty message", async () => {
    const res = await fetch(`${TREASURY_URL}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await sleep(800);
  await test("Chat rejects oversized message", async () => {
    const res = await fetch(`${TREASURY_URL}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "x".repeat(600) }),
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
