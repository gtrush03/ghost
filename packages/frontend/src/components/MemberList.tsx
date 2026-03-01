import { User } from "lucide-react";
import type { PoolMember } from "../lib/types";
import { shortenAddress, formatUsd } from "../lib/utils";

interface MemberListProps {
  members: PoolMember[];
  currentWallet: string | null;
}

export function MemberList({ members, currentWallet }: MemberListProps) {
  if (members.length === 0) {
    return (
      <div className="text-xs text-text-muted py-4 text-center">
        No members yet. Connect your wallet and deposit to join.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const isMe = currentWallet?.toLowerCase() === m.walletAddress.toLowerCase();
        return (
          <div
            key={m.id}
            className={`p-3 rounded-lg border transition-colors ${
              isMe
                ? "border-gold/30 bg-gold/5"
                : "border-glass-border bg-glass"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className={`w-3.5 h-3.5 ${isMe ? "text-gold" : "text-text-muted"}`} />
                <span className="text-xs font-mono text-text-primary">
                  {shortenAddress(m.walletAddress)}
                </span>
                {isMe && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-medium">
                    You
                  </span>
                )}
              </div>
              <span className="text-xs text-text-secondary">
                {formatUsd(m.netValueUsd)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                  <span>Share: {m.sharePercent.toFixed(1)}%</span>
                  <span>Vote: {(m.votingPower * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full gold-gradient-bg transition-all duration-500"
                    style={{ width: `${Math.min(100, m.sharePercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
