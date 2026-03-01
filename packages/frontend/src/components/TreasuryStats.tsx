import { Shield, Lock, Loader2 } from "lucide-react";
import type { TreasuryDisplay } from "../lib/types";
import { formatUsd } from "../lib/utils";
import { AllocationBar } from "./AllocationBar";

interface TreasuryStatsProps {
  treasury: TreasuryDisplay | null;
}

export function TreasuryStats({ treasury }: TreasuryStatsProps) {
  if (!treasury) {
    return (
      <div className="glass-card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Treasury Value
          </h2>
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Connecting to backend...</span>
        </div>
      </div>
    );
  }

  const privacyLabel =
    treasury.privacyStatus === "shielded" ? "Fully Shielded"
    : treasury.privacyStatus === "partial" ? "Partially Shielded"
    : treasury.privacyStatus === "exposed" ? "Exposed"
    : "Unknown";

  return (
    <div className="glass-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Treasury Value
        </h2>
        {treasury.privacyStatus === "shielded" && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 border border-success/20">
            <Lock className="w-3 h-3 text-success" />
            <span className="text-[10px] font-medium text-success uppercase tracking-wider">
              {privacyLabel}
            </span>
          </div>
        )}
      </div>

      <div className="gold-gradient-text text-3xl font-bold tracking-tight">
        {treasury.totalValueUsd > 0 ? formatUsd(treasury.totalValueUsd) : "--"}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Allocation
        </h3>
        {treasury.balances.length === 0 ? (
          <p className="text-xs text-text-muted">No balances found</p>
        ) : (
          treasury.balances.map((b) => (
            <AllocationBar
              key={b.symbol}
              symbol={b.symbol}
              amount={b.amount}
              allocationPct={b.allocationPct}
              color={b.color}
              valueUsd={b.valueUsd}
            />
          ))
        )}
      </div>

      <div className="pt-3 border-t border-glass-border">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-gold-dim" />
          <span className="text-xs text-text-muted">Privacy Pool</span>
        </div>
      </div>
    </div>
  );
}
