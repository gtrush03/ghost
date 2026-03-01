import { useState, useEffect, useCallback } from "react";
import type { PoolMember, PoolState } from "../lib/types";
import { fetchPoolMembers } from "../lib/api";

export function usePool(walletAddress: string | null): {
  pool: PoolState;
  refresh: () => void;
} {
  const [members, setMembers] = useState<PoolMember[]>([]);

  const refresh = useCallback(() => {
    fetchPoolMembers()
      .then(setMembers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const totalValueUsd = members.reduce((sum, m) => sum + m.netValueUsd, 0);
  const me = walletAddress
    ? members.find((m) => m.walletAddress.toLowerCase() === walletAddress.toLowerCase())
    : null;

  const pool: PoolState = {
    members,
    myShare: me?.sharePercent ?? 0,
    myVotingPower: me?.votingPower ?? 0,
    totalMembers: members.length,
    totalValueUsd,
  };

  return { pool, refresh };
}
