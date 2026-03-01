import { useState, useEffect, useCallback } from "react";
import type { TreasuryDisplay } from "../lib/types";
import { fetchTreasuryState } from "../lib/api";
import { TOKEN_COLORS } from "../lib/constants";

// Rough USD prices for allocation weighting
const TOKEN_PRICES: Record<string, number> = { USDC: 1, WMON: 0.42, MON: 0.42, ETH: 3847 };

export function useTreasury() {
  const [treasury, setTreasury] = useState<TreasuryDisplay | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchTreasuryState();
      if (!data.balances || Object.keys(data.balances).length === 0) {
        setTreasury({
          balances: [],
          totalValueUsd: data.totalValueUsd ?? 0,
          privacyStatus: (data.privacyStatus as TreasuryDisplay["privacyStatus"]) ?? "unknown",
          lastUpdated: data.lastUpdated ?? new Date().toISOString(),
        });
        return;
      }

      const entries = Object.entries(data.balances);

      // Backend now returns symbol keys (e.g. "USDC", "WMON") and human-readable amounts
      const totalUsd = data.totalValueUsd || 0;

      const balances = entries.map(([symbol, amount]) => {
        const amountNum = parseFloat(amount) || 0;
        const price = TOKEN_PRICES[symbol] ?? 0;
        const valueUsd = amountNum * price;

        return {
          token: symbol,
          symbol,
          amount,
          valueUsd: Math.round(valueUsd * 100) / 100,
          allocationPct: 0,
          color: TOKEN_COLORS[symbol] ?? "#928466",
        };
      });

      // Calculate allocation percentages based on USD value
      if (totalUsd > 0) {
        balances.forEach((b) => {
          b.allocationPct = Math.round((b.valueUsd / totalUsd) * 100);
        });
        // Fix rounding to sum to 100
        const sum = balances.reduce((s, b) => s + b.allocationPct, 0);
        if (sum !== 100 && balances.length > 0) {
          balances[0].allocationPct += 100 - sum;
        }
      }

      setTreasury({
        balances,
        totalValueUsd: totalUsd,
        privacyStatus: (data.privacyStatus as TreasuryDisplay["privacyStatus"]) ?? "shielded",
        lastUpdated: data.lastUpdated ?? new Date().toISOString(),
      });
    } catch {
      // Leave treasury as null — UI will show loading/offline state
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { treasury, refresh };
}
