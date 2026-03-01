import { Users, Wallet } from "lucide-react";
import type { PoolState } from "../lib/types";
import { formatUsd } from "../lib/utils";

interface PoolBarProps {
  pool: PoolState;
  walletAddress: string | null;
  onConnect: () => void;
}

export function PoolBar({ pool, walletAddress, onConnect }: PoolBarProps) {
  return (
    <div className="glass-card px-4 py-2 flex items-center justify-between text-xs">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-gold-dim" />
          <span className="text-text-muted">Members:</span>
          <span className="text-text-primary font-medium">{pool.totalMembers}</span>
        </div>

        {pool.totalValueUsd > 0 && (
          <>
            <div className="w-px h-3 bg-glass-border" />
            <div>
              <span className="text-text-muted">Pool: </span>
              <span className="text-text-primary font-medium">{formatUsd(pool.totalValueUsd)}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {walletAddress && pool.myShare > 0 && (
          <>
            <div>
              <span className="text-text-muted">Your share: </span>
              <span className="text-gold font-medium">{pool.myShare.toFixed(1)}%</span>
            </div>
            <div className="w-px h-3 bg-glass-border" />
            <div>
              <span className="text-text-muted">Voting power: </span>
              <span className="text-gold font-medium">{(pool.myVotingPower * 100).toFixed(1)}%</span>
            </div>
          </>
        )}
        {!walletAddress && (
          <button
            onClick={onConnect}
            className="flex items-center gap-1 text-gold hover:text-gold-light transition-colors cursor-pointer"
          >
            <Wallet className="w-3 h-3" />
            Connect wallet to join
          </button>
        )}
      </div>
    </div>
  );
}
