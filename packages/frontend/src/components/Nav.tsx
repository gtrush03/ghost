import { Ghost, Shield, ArrowDownToLine } from "lucide-react";
import { WalletButton } from "./WalletButton";

interface NavProps {
  isLive: boolean;
  brain: string;
  onDeposit?: () => void;
  walletAddress: string | null;
  isConnecting: boolean;
  chainOk: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Nav({ isLive, brain, onDeposit, walletAddress, isConnecting, chainOk, onConnect, onDisconnect }: NavProps) {
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-40">
      <div className="glass-card px-6 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Ghost className="w-5 h-5 text-gold" />
          <span className="font-semibold text-text-primary text-sm tracking-wide">
            Ghost Treasury
          </span>
        </div>

        <div className="w-px h-4 bg-glass-border" />

        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-gold-dim" />
          <span className="text-text-secondary text-xs">Private</span>
        </div>

        <div className="w-px h-4 bg-glass-border" />

        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isLive ? "bg-success" : "bg-warning"
            }`}
            style={{
              boxShadow: isLive
                ? "0 0 6px rgba(74, 222, 128, 0.5)"
                : "0 0 6px rgba(251, 191, 36, 0.5)",
            }}
          />
          <span className="text-text-secondary text-xs">
            {isLive ? "Live" : "Offline"}
          </span>
        </div>

        {brain !== "offline" && (
          <>
            <div className="w-px h-4 bg-glass-border" />
            <span className="text-xs text-gold-dim font-mono">{brain}</span>
          </>
        )}

        {onDeposit && (
          <>
            <div className="w-px h-4 bg-glass-border" />
            <button
              onClick={onDeposit}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg
                         bg-gold/10 border border-gold/20 text-gold text-xs font-medium
                         hover:bg-gold/20 transition-colors cursor-pointer"
            >
              <ArrowDownToLine className="w-3 h-3" />
              Deposit
            </button>
          </>
        )}

        <div className="w-px h-4 bg-glass-border" />

        <WalletButton
          address={walletAddress}
          isConnecting={isConnecting}
          chainOk={chainOk}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
      </div>
    </nav>
  );
}
