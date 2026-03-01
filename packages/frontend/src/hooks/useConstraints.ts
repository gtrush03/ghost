import { useState, useEffect, useCallback } from "react";
import type { SettingsResponse } from "../lib/types";
import { fetchConstraints } from "../lib/api";

const DEFAULTS: SettingsResponse = {
  constraints: { maxTradePct: 10, cooldownMinutes: 5, allowedTokens: [], paused: false },
  governance: { requiredPower: 0.51, totalMembers: 0, netPoolUsd: 0 },
  recentChanges: [],
};

export function useConstraints(): {
  settings: SettingsResponse;
  refresh: () => void;
} {
  const [settings, setSettings] = useState<SettingsResponse>(DEFAULTS);

  const refresh = useCallback(() => {
    fetchConstraints()
      .then(setSettings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { settings, refresh };
}
