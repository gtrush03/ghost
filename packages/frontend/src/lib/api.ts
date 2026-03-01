import type { ChatApiResponse, HealthInfo, PoolMember, SettingsResponse } from "./types";

const SESSION_TOKEN_KEY = "ghost:session";

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
  }
}

export async function sendChatMessage(message: string, walletAddress?: string): Promise<ChatApiResponse> {
  let res: Response;
  try {
    res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ message, wallet: walletAddress }),
    });
  } catch {
    throw new Error("Network error — backend may be offline");
  }

  if (!res.ok) {
    const err = await safeJson<{ error?: string }>(res).catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await safeJson<Record<string, unknown>>(res);

  // Validate response shape
  const response = typeof data.response === "string" ? data.response : "";
  const toolCalls = Array.isArray(data.toolCalls)
    ? data.toolCalls.filter(
        (tc: any) => tc && typeof tc.name === "string"
      ).map((tc: any) => ({
        name: String(tc.name),
        input: (tc.input && typeof tc.input === "object") ? tc.input : {},
        result: tc.result,
      }))
    : undefined;
  const events = Array.isArray(data.events)
    ? data.events.filter((e: any) => e && typeof e.type === "string")
    : undefined;

  return { response, toolCalls, events: events as ChatApiResponse["events"] };
}

export async function confirmAction(actionId: string, retryAuth?: () => Promise<string | null>): Promise<{ confirmed: boolean; result?: unknown }> {
  let res = await fetch("/api/agent/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ actionId, approved: true }),
  });

  // Auto-retry on 401 if we can refresh auth
  if (res.status === 401 && retryAuth) {
    const newToken = await retryAuth();
    if (newToken) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, newToken);
      res = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${newToken}` },
        body: JSON.stringify({ actionId, approved: true }),
      });
    }
  }

  if (!res.ok) {
    const err = await safeJson<{ error?: string }>(res).catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return safeJson(res);
}

export async function rejectAction(actionId: string): Promise<{ rejected: boolean }> {
  const res = await fetch("/api/agent/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ actionId, approved: false }),
  });
  if (!res.ok) {
    const err = await safeJson<{ error?: string }>(res).catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return safeJson(res);
}

export async function fetchTreasuryState(): Promise<{
  balances: Record<string, string>;
  totalValueUsd: number;
  privacyStatus: string;
  lastUpdated?: string;
  error?: string;
}> {
  let res: Response;
  try {
    res = await fetch("/api/treasury/state");
  } catch {
    throw new Error("Network error");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await safeJson<Record<string, unknown>>(res);

  // Validate balances is an object of strings
  const raw = data.balances;
  const balances: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      balances[k] = String(v);
    }
  }

  return {
    balances,
    totalValueUsd: typeof data.totalValueUsd === "number" ? data.totalValueUsd : 0,
    privacyStatus: typeof data.privacyStatus === "string" ? data.privacyStatus : "unknown",
    lastUpdated: typeof data.lastUpdated === "string" ? data.lastUpdated : undefined,
    error: typeof data.error === "string" ? data.error : undefined,
  };
}

export async function fetchChatHistory(): Promise<{
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    toolCalls?: Array<{ name: string; input: Record<string, unknown>; result?: unknown }>;
  }>;
}> {
  let res: Response;
  try {
    res = await fetch("/api/agent/history", {
      headers: getAuthHeaders(),
    });
  } catch {
    throw new Error("Network error");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await safeJson<Record<string, unknown>>(res);
  const messages = Array.isArray(data.messages) ? data.messages : [];

  return {
    messages: messages
      .filter((m: any) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
      .map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: typeof m.timestamp === "string" ? m.timestamp : new Date().toISOString(),
        toolCalls: Array.isArray(m.toolCalls) ? m.toolCalls : undefined,
      })),
  };
}

export async function clearChatHistory(): Promise<void> {
  try {
    await fetch("/api/agent/clear", { method: "POST", headers: getAuthHeaders() });
  } catch {
    // Silently ignore — best effort
  }
}

export async function fetchHealth(): Promise<HealthInfo> {
  let res: Response;
  try {
    res = await fetch("/health");
  } catch {
    throw new Error("Network error");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await safeJson<Record<string, unknown>>(res);

  return {
    agent: typeof data.agent === "string" ? data.agent : "unknown",
    status: typeof data.status === "string" ? data.status : "unknown",
    phase: typeof data.phase === "number" ? data.phase : 0,
    brain: typeof data.brain === "string" ? data.brain : "unknown",
    model: typeof data.model === "string" ? data.model : "unknown",
  };
}

export async function fetchPrice(asset: string): Promise<{ price: number }> {
  let res: Response;
  try {
    res = await fetch(`/price/${asset.toLowerCase()}`);
  } catch {
    throw new Error("Network error");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await safeJson<Record<string, unknown>>(res);
  return { price: typeof data.price === "number" ? data.price : 0 };
}

export async function fetchPoolMembers(): Promise<PoolMember[]> {
  let res: Response;
  try {
    res = await fetch("/api/members", {
      headers: getAuthHeaders(),
    });
  } catch {
    throw new Error("Network error");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await safeJson<{ members?: unknown[] }>(res);
  if (!Array.isArray(data.members)) return [];

  return data.members.map((m: any) => ({
    id: m.id ?? 0,
    walletAddress: m.walletAddress ?? "",
    displayName: m.displayName ?? null,
    joinedAt: m.joinedAt ?? "",
    isActive: m.isActive ?? true,
    totalDepositedUsd: m.totalDepositedUsd ?? 0,
    totalWithdrawnUsd: m.totalWithdrawnUsd ?? 0,
    netValueUsd: m.netValueUsd ?? 0,
    votingPower: m.votingPower ?? 0,
    sharePercent: m.sharePercent ?? 0,
  }));
}

export async function fetchConstraints(): Promise<SettingsResponse> {
  let res: Response;
  try {
    res = await fetch("/api/treasury/settings");
  } catch {
    return {
      constraints: { maxTradePct: 10, cooldownMinutes: 5, allowedTokens: [], paused: false },
      governance: { requiredPower: 0.51, totalMembers: 0, netPoolUsd: 0 },
      recentChanges: [],
    };
  }
  if (!res.ok) {
    return {
      constraints: { maxTradePct: 10, cooldownMinutes: 5, allowedTokens: [], paused: false },
      governance: { requiredPower: 0.51, totalMembers: 0, netPoolUsd: 0 },
      recentChanges: [],
    };
  }

  return safeJson<SettingsResponse>(res);
}

export async function fetchActivityLog(params?: {
  limit?: number;
  offset?: number;
  type?: string;
}): Promise<{
  activities: Array<{
    id: number;
    eventType: string;
    refId: number | null;
    actorWallet: string | null;
    summary: string;
    details: Record<string, unknown> | null;
    privacy: string;
    createdAt: string;
  }>;
}> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.type) searchParams.set("type", params.type);

  let res: Response;
  try {
    res = await fetch(`/api/activity?${searchParams.toString()}`);
  } catch {
    return { activities: [] };
  }
  if (!res.ok) return { activities: [] };
  return safeJson(res);
}

export async function fetchStrategyRules(): Promise<{
  rules: Array<{
    id: number;
    ruleType: string;
    tokenSymbol: string | null;
    targetPct: number | null;
    triggerPrice: number | null;
    triggerDirection: string | null;
    triggerAction: string | null;
    triggerAmountPct: number | null;
    thresholdPct: number | null;
    createdAt: string;
  }>;
}> {
  let res: Response;
  try {
    res = await fetch("/api/strategy/rules");
  } catch {
    return { rules: [] };
  }
  if (!res.ok) return { rules: [] };
  return safeJson(res);
}

export async function fetchStrategyStatus(): Promise<{
  running: boolean;
  lastEvaluation: string | null;
}> {
  let res: Response;
  try {
    res = await fetch("/api/strategy/status");
  } catch {
    return { running: false, lastEvaluation: null };
  }
  if (!res.ok) return { running: false, lastEvaluation: null };
  return safeJson(res);
}

export async function registerMember(wallet: string): Promise<{ member: any; votingPower: number }> {
  const res = await fetch("/api/members/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ wallet }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return safeJson(res);
}
