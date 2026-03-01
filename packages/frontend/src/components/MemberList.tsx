import { User, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { PoolMember } from "../lib/types";
import { shortenAddress, formatUsd } from "../lib/utils";

interface MemberListProps {
  members: PoolMember[];
  currentWallet: string | null;
}

export function MemberList({ members, currentWallet }: MemberListProps) {
  const [copied, setCopied] = useState(false);

  if (members.length === 0) {
    return (
      <div className="text-xs text-text-muted py-4 text-center">
        No members yet. Connect your wallet and deposit to join.
      </div>
    );
  }

  const myMember = currentWallet
    ? members.find((m) => m.walletAddress.toLowerCase() === currentWallet.toLowerCase())
    : null;
  const otherMembers = members.filter(
    (m) => !myMember || m.id !== myMember.id
  );

  const copyAddress = () => {
    if (!currentWallet) return;
    navigator.clipboard.writeText(currentWallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      {/* Your Account card */}
      {myMember && (
        <div className="p-3 rounded-lg border border-gold/30 bg-gold/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-medium text-gold">Your Account</span>
            </div>
            <span className="text-xs text-text-secondary">
              {formatUsd(myMember.netValueUsd)}
            </span>
          </div>

          {/* Full address with copy */}
          <button
            onClick={copyAddress}
            className="w-full flex items-center gap-2 text-[10px] font-mono text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            <span className="truncate">{currentWallet}</span>
            {copied ? (
              <Check className="w-3 h-3 text-success shrink-0" />
            ) : (
              <Copy className="w-3 h-3 shrink-0" />
            )}
          </button>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-text-muted">Share</div>
              <div className="text-sm font-semibold text-gold">{myMember.sharePercent.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[10px] text-text-muted">Voting Power</div>
              <div className="text-sm font-semibold text-gold">{(myMember.votingPower * 100).toFixed(1)}%</div>
            </div>
          </div>

          {/* Share bar */}
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full gold-gradient-bg transition-all duration-500"
              style={{ width: `${Math.min(100, myMember.sharePercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* Other members */}
      {otherMembers.map((m) => (
        <div
          key={m.id}
          className="p-3 rounded-lg border border-glass-border bg-glass"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-mono text-text-primary">
                {shortenAddress(m.walletAddress)}
              </span>
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
      ))}
    </div>
  );
}
