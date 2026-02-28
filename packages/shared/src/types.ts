// Treasury state
export interface TreasuryState {
  balances: TokenBalance[];
  totalValueUsd: number;
  privacyStatus: "shielded" | "partial" | "exposed";
  lastUpdated: string;
}

export interface TokenBalance {
  token: string;
  symbol: string;
  amount: string;
  valueUsd: number;
  allocationPct: number;
}

// Agent
export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
}

export interface AgentEvent {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

// Constraints
export interface TreasuryConstraints {
  maxTradePct: number;
  cooldownMinutes: number;
  allowedTokens: string[];
  paused: boolean;
}

// Activity
export interface ActivityEntry {
  id: string;
  timestamp: string;
  type: "deposit" | "withdraw" | "swap" | "x402_payment" | "constraint_check" | "rejection";
  description: string;
  details: Record<string, unknown>;
  privacy: "private" | "burner" | "public";
}

// x402 price response
export interface PriceData {
  asset: string;
  price: number;
  timestamp: string;
  source: string;
}
