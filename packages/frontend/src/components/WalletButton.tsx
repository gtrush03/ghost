import { Wallet, ChevronDown, LogOut, Copy, Check, ExternalLink, ShieldCheck, ShieldOff } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { shortenAddress } from "../lib/utils";

interface WalletButtonProps {
  address: string | null;
  isConnecting: boolean;
  chainOk: boolean;
  authToken: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletButton({ address, isConnecting, chainOk, authToken, onConnect, onDisconnect }: WalletButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-glass border border-glass-border backdrop-blur-[40px] rounded-xl p-2 z-50 space-y-1">
          {/* Full address with copy */}
          <div className="px-3 py-2">
            <div className="text-[10px] text-text-muted mb-1">Wallet Address</div>
            <button
              onClick={copyAddress}
              className="w-full flex items-center gap-2 text-xs font-mono text-text-primary hover:text-gold transition-colors cursor-pointer"
            >
              <span className="truncate flex-1 text-left">{address}</span>
              {copied ? (
                <Check className="w-3 h-3 text-success shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-text-muted shrink-0" />
              )}
            </button>
          </div>

          <div className="h-px bg-glass-border mx-1" />

          {/* Chain status */}
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-text-muted">Network</span>
            <span className={`text-[10px] font-medium ${chainOk ? "text-success" : "text-warning"}`}>
              {chainOk ? "Monad Testnet" : "Wrong Network"}
            </span>
          </div>

          {/* Auth status */}
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-text-muted">Auth</span>
            <div className="flex items-center gap-1">
              {authToken ? (
                <>
                  <ShieldCheck className="w-3 h-3 text-success" />
                  <span className="text-[10px] text-success font-medium">Authenticated</span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-3 h-3 text-warning" />
                  <span className="text-[10px] text-warning font-medium">Not signed in</span>
                </>
              )}
            </div>
          </div>

          <div className="h-px bg-glass-border mx-1" />

          {/* View on explorer */}
          <a
            href={`https://testnet.monadscan.com/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary
                       hover:bg-glass-hover rounded-lg transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            View on MonadScan
          </a>

          {/* Disconnect */}
          <button
            onClick={() => { onDisconnect(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400/70
                       hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
