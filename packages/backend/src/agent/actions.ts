import { randomUUID } from "crypto";

export interface PendingAction {
  actionId: string;
  wallet: string;
  type: "swap" | "settings" | "withdrawal" | "strategy_rule";
  params: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

const ACTION_TTL = 5 * 60 * 1000; // 5 minutes
const pendingActions: Map<string, PendingAction> = new Map();

function cleanupExpired() {
  const now = Date.now();
  for (const [id, action] of pendingActions) {
    if (action.expiresAt < now) pendingActions.delete(id);
  }
}

export function createAction(
  wallet: string,
  type: PendingAction["type"],
  params: Record<string, unknown>
): string {
  cleanupExpired();
  const actionId = randomUUID();
  pendingActions.set(actionId, {
    actionId,
    wallet: wallet.toLowerCase(),
    type,
    params,
    createdAt: Date.now(),
    expiresAt: Date.now() + ACTION_TTL,
  });
  return actionId;
}

export function consumeAction(actionId: string, wallet: string): PendingAction | null {
  cleanupExpired();
  const action = pendingActions.get(actionId);
  if (!action) return null;
  if (action.wallet !== wallet.toLowerCase()) return null;
  pendingActions.delete(actionId);
  return action;
}

export function getAction(actionId: string): PendingAction | null {
  cleanupExpired();
  return pendingActions.get(actionId) ?? null;
}
