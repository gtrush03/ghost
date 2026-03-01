import { Shield, ArrowDownToLine } from "lucide-react";
import { GhostLogo } from "./GhostLogo";
import { WalletButton } from "./WalletButton";

interface NavProps {
  isLive: boolean;
  brain: string;
  onDeposit?: () => void;
  walletAddress: string | null;
  isConnecting: boolean;
  chainOk: boolean;
  authToken: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Nav({ isLive, brain, onDeposit, walletAddress, isConnecting, chainOk, authToken, onConnect, onDisconnect }: NavProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-glass border-b border-glass-border backdrop-blur-[40px]">
      <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <GhostLogo className="w-5 h-5" variant="gold" />
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

        <div className="flex-1" />

        {onDeposit && (
          <>
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

        <WalletButton
          address={walletAddress}
          isConnecting={isConnecting}
          chainOk={chainOk}
          authToken={authToken}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
      </div>
    </nav>
  );
}
