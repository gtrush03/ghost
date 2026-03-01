import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, Settings, ArrowUpFromLine, Zap, Check, X, Loader2 } from "lucide-react";

export interface PendingActionDisplay {
  actionId: string;
  type: "swap" | "settings" | "withdrawal" | "strategy_rule";
  message: string;
  params: Record<string, unknown>;
  expiresIn: string;
  from?: string;
  to?: string;
  amount?: string;
  amountUsd?: number;
}

interface ConfirmationCardProps {
  action: PendingActionDisplay;
  onConfirm: (actionId: string) => void;
  onReject: (actionId: string) => void;
}

const ICONS = {
  swap: ArrowRightLeft,
  settings: Settings,
  withdrawal: ArrowUpFromLine,
  strategy_rule: Zap,
};

const LABELS = {
  swap: "Swap Proposed",
  settings: "Settings Change Proposed",
  withdrawal: "Withdrawal Proposed",
  strategy_rule: "Strategy Rule Proposed",
};

export function ConfirmationCard({ action, onConfirm, onReject }: ConfirmationCardProps) {
  const [processing, setProcessing] = useState(false);
  const [resolved, setResolved] = useState<"confirmed" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(300); // 5 minutes

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleConfirm = () => {
    setProcessing(true);
    setError(null);
    try {
      onConfirm(action.actionId);
      setResolved("confirmed");
    } catch (err: any) {
      setError(err.message || "Confirmation failed");
      setProcessing(false);
    }
  };

  const handleReject = () => {
    setProcessing(true);
    setError(null);
    onReject(action.actionId);
    setResolved("rejected");
  };

  const Icon = ICONS[action.type];
  const expired = secondsLeft <= 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  if (resolved) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-glass/70 border border-glass-border p-4 mt-2"
      >
        <div className="flex items-center gap-2 text-sm">
          {resolved === "confirmed" ? (
            <>
              <Loader2 className="w-4 h-4 text-gold animate-spin" />
              <span className="text-gold font-medium">Confirmed — executing...</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                <X className="w-3 h-3 text-red-400" />
              </div>
              <span className="text-red-400 font-medium">Rejected</span>
            </>
          )}
        </div>
        {error && (
          <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl bg-glass/80 border border-gold/20 p-4 mt-2 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-gold" />
          </div>
          <span className="text-sm font-medium text-gold">{LABELS[action.type]}</span>
        </div>
        <span className={`text-xs font-mono ${expired ? "text-red-400" : "text-text-muted"}`}>
          {expired ? "Expired" : `${minutes}:${seconds.toString().padStart(2, "0")}`}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        {action.type === "swap" && (
          <>
            <DetailRow label="From" value={`${action.amount ?? "?"} ${action.from ?? "?"}`} />
            <DetailRow label="To" value={action.to ?? "?"} />
            {action.amountUsd != null && (
              <DetailRow label="Value" value={`~$${action.amountUsd.toFixed(2)}`} />
            )}
          </>
        )}
        {action.type === "settings" && (
          <>
            <DetailRow
              label="Setting"
              value={String(action.params.setting ?? "?")}
            />
            <DetailRow
              label="New Value"
              value={String(action.params.value ?? "?")}
            />
          </>
        )}
        {action.type === "withdrawal" && (
          <>
            <DetailRow label="Token" value={String(action.params.token ?? "?")} />
            <DetailRow label="Amount" value={String(action.params.amount ?? "?")} />
          </>
        )}
        {action.type === "strategy_rule" && (
          <>
            <DetailRow label="Action" value={String(action.params.description ?? action.message ?? "?")} />
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConfirm}
          disabled={processing || expired}
          className="flex-1 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer
                     bg-gold/20 text-gold border border-gold/30
                     hover:bg-gold/30 disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-1.5"
        >
          {processing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          {processing ? "Confirming..." : "Confirm"}
        </button>
        <button
          onClick={handleReject}
          disabled={processing || expired}
          className="flex-1 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer
                     bg-glass border border-glass-border text-text-muted
                     hover:text-text-secondary hover:border-red-500/30
                     disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-1.5"
        >
          <X className="w-3 h-3" />
          Reject
        </button>
      </div>
    </motion.div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary font-mono">{value}</span>
    </div>
  );
}
