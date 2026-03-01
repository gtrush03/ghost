export interface DisplayBalance {
  token: string;
  symbol: string;
  amount: string;
  valueUsd: number;
  allocationPct: number;
  color: string;
}

export interface TreasuryDisplay {
  balances: DisplayBalance[];
  totalValueUsd: number;
  privacyStatus: "shielded" | "partial" | "exposed" | "unknown";
  lastUpdated: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: DisplayToolCall[];
  isStreaming?: boolean;
  streamedContent?: string;
}

export interface DisplayToolCall {
  name: string;
  displayName: string;
  input: Record<string, unknown>;
  result?: unknown;
  status: "running" | "complete";
  duration?: number;
  cost?: string;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  type: "deposit" | "withdraw" | "swap" | "x402_payment" | "constraint_check" | "rejection" | "chat";
  description: string;
  privacy: "private" | "burner" | "public";
}

export interface HealthInfo {
  agent: string;
  status: string;
  phase: number;
  brain: string;
  model: string;
}

export interface AgentEvent {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface ChatApiResponse {
  response: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown>; result?: unknown }>;
  events?: AgentEvent[];
}

// DAO types

export interface PoolMember {
  id: number;
  walletAddress: string;
  displayName: string | null;
  joinedAt: string;
  isActive: boolean;
  totalDepositedUsd: number;
  totalWithdrawnUsd: number;
  netValueUsd: number;
  votingPower: number;
  sharePercent: number;
}

export interface PoolState {
  members: PoolMember[];
  myShare: number;
  myVotingPower: number;
  totalMembers: number;
  totalValueUsd: number;
}

export interface Constraints {
  maxTradePct: number;
  cooldownMinutes: number;
  allowedTokens: string[];
  paused: boolean;
}

export interface SettingsResponse {
  constraints: Constraints;
  governance: {
    requiredPower: number;
    totalMembers: number;
    netPoolUsd: number;
  };
  recentChanges: Array<{
    id: number;
    settingKey: string;
    oldValue: string;
    newValue: string;
    votingPower: number;
    approved: boolean;
    createdAt: string;
  }>;
}
