// DAO membership and governance types

export interface Member {
  id: number;
  walletAddress: string;
  displayName: string | null;
  joinedAt: string;
  isActive: boolean;
}

export interface MemberWithPower extends Member {
  totalDepositedUsd: number;
  totalWithdrawnUsd: number;
  netValueUsd: number;
  votingPower: number; // 0-1, percentage of pool
  sharePercent: number; // 0-100
}

export interface DepositRecord {
  id: number;
  memberId: number;
  tokenAddress: string;
  amountRaw: string;
  amountHuman: number;
  amountUsd: number;
  relayId: string | null;
  status: "pending" | "confirmed" | "failed";
  createdAt: string;
  confirmedAt: string | null;
}

export interface WithdrawalRecord {
  id: number;
  memberId: number;
  tokenAddress: string;
  amountRaw: string;
  amountHuman: number;
  amountUsd: number;
  relayId: string | null;
  status: "pending" | "confirmed" | "failed";
  createdAt: string;
  confirmedAt: string | null;
}

export interface SettingsChangeRecord {
  id: number;
  requestedBy: number;
  settingKey: string;
  oldValue: string;
  newValue: string;
  votingPower: number;
  requiredPower: number;
  approved: boolean;
  createdAt: string;
}

export interface PoolStats {
  totalMembers: number;
  activeMembers: number;
  totalDepositedUsd: number;
  totalWithdrawnUsd: number;
  netPoolUsd: number;
}

export interface ConstraintsState {
  maxTradePct: number;
  cooldownMinutes: number;
  allowedTokens: string[];
  paused: boolean;
}
