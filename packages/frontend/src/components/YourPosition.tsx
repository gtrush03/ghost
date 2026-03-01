import { TrendingUp, Wallet } from "lucide-react";
import { formatUsd } from "../lib/utils";

interface YourPositionProps {
  walletAddress: string | null;
  sharePercent: number;
  votingPower: number;
  netValueUsd: number;
  onConnect: () => void;
}

export function YourPosition({ walletAddress, sharePercent, votingPower, netValueUsd, onConnect }: YourPositionProps) {
  if (!walletAddress) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
          Your Position
        </h3>
        <button
          onClick={onConnect}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                     bg-gold/10 border border-gold/20 text-gold text-xs font-medium
                     hover:bg-gold/20 transition-colors cursor-pointer"
        >
          <Wallet className="w-3.5 h-3.5" />
          Connect wallet to view
        </button>
      </div>
    );
  }

  if (sharePercent === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
          Your Position
        </h3>
        <p className="text-xs text-text-muted">
          Deposit to the pool to become a member and earn voting power.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
        Your Position
      </h3>
      <div className="space-y-3">
        <div>
          <div className="text-xl font-bold gold-gradient-text">{formatUsd(netValueUsd)}</div>
        </div>
        <div className="flex gap-4">
          <div>
            <div className="text-[10px] text-text-muted uppercase">Share</div>
            <div className="text-sm font-medium text-text-primary flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-gold-dim" />
              {sharePercent.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase">Voting Power</div>
            <div className="text-sm font-medium text-text-primary">
              {(votingPower * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
