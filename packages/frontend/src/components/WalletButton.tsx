import { Wallet, ChevronDown, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { shortenAddress } from "../lib/utils";

interface WalletButtonProps {
  address: string | null;
  isConnecting: boolean;
  chainOk: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletButton({ address, isConnecting, chainOk, onConnect, onDisconnect }: WalletButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!address) {
    return (
      <button
        onClick={onConnect}
        disabled={isConnecting}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg
                   bg-gold/10 border border-gold/20 text-gold text-xs font-medium
                   hover:bg-gold/20 transition-colors cursor-pointer disabled:opacity-50"
      >
        <Wallet className="w-3 h-3" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg
                   bg-glass border border-glass-border text-text-primary text-xs font-mono
                   hover:border-gold-dim/30 transition-colors cursor-pointer"
      >
        <div
          className={`w-2 h-2 rounded-full ${chainOk ? "bg-success" : "bg-warning"}`}
          style={{ boxShadow: chainOk ? "0 0 6px rgba(74, 222, 128, 0.5)" : "0 0 6px rgba(251, 191, 36, 0.5)" }}
        />
        {shortenAddress(address)}
        <ChevronDown className="w-3 h-3 text-text-muted" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 glass-card p-1 z-50">
          {!chainOk && (
            <div className="px-3 py-2 text-[10px] text-warning">
              Wrong network. Switch to Monad Testnet.
            </div>
          )}
          <button
            onClick={() => { onDisconnect(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary
                       hover:bg-glass-hover rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
