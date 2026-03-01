import { useState, useEffect, useCallback } from "react";
import { Clock, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Settings, Filter, ExternalLink, Eye, EyeOff } from "lucide-react";
import { fetchActivityLog } from "../lib/api";

interface ActivityEntry {
  id: number;
  eventType: string;
  refId: number | null;
  actorWallet: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  privacy: string;
  createdAt: string;
}

const FILTERS = [
  { id: "all", label: "All", icon: Filter },
  { id: "trade", label: "Trades", icon: ArrowRightLeft },
  { id: "deposit", label: "Deposits", icon: ArrowDownToLine },
  { id: "withdrawal", label: "Withdrawals", icon: ArrowUpFromLine },
  { id: "settings_change", label: "Settings", icon: Settings },
] as const;

const EVENT_ICONS: Record<string, typeof Clock> = {
  trade: ArrowRightLeft,
  autonomous_trade: ArrowRightLeft,
  deposit: ArrowDownToLine,
  deposit_confirmed: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  settings_change: Settings,
  strategy_rule_created: Settings,
  strategy_rule_deactivated: Settings,
  member_joined: Clock,
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

function shortenWallet(w: string): string {
  return `${w.slice(0, 6)}...${w.slice(-4)}`;
}

export function ActivityLedger() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const typeParam = filter === "all" ? undefined : filter;
    const data = await fetchActivityLog({ limit: 50, type: typeParam });
    setEntries(data.activities);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
        Activity Ledger
      </h2>

      {/* Filter buttons */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-gold/10 border border-gold/20 text-gold"
                  : "text-text-muted hover:text-text-secondary hover:bg-glass-hover border border-transparent"
              }`}
            >
              <Icon className="w-3 h-3" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {loading ? (
          <p className="text-xs text-text-muted text-center py-4">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">No activity yet</p>
        ) : (
          entries.map((entry) => (
            <ActivityLedgerEntry key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}

function ActivityLedgerEntry({ entry }: { entry: ActivityEntry }) {
  const Icon = EVENT_ICONS[entry.eventType] ?? Clock;
  const txHash = entry.details?.txHash as string | undefined;
  const isAuto = entry.eventType === "autonomous_trade";

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-glass-hover transition-colors">
      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isAuto ? "bg-purple-500/10 border border-purple-500/20" : "bg-gold/10 border border-gold/20"
      }`}>
        <Icon className={`w-3 h-3 ${isAuto ? "text-purple-400" : "text-gold"}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-primary truncate">{entry.summary}</span>
          {isAuto && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 flex-shrink-0">
              AUTO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {entry.actorWallet && (
            <span className="text-[10px] text-text-muted font-mono">
              {shortenWallet(entry.actorWallet)}
            </span>
          )}
          <span className="text-[10px] text-text-muted">{formatTime(entry.createdAt)}</span>
          {entry.privacy === "private" ? (
            <EyeOff className="w-2.5 h-2.5 text-text-muted" />
          ) : (
            <Eye className="w-2.5 h-2.5 text-text-muted" />
          )}
          {txHash && (
            <a
              href={`https://testnet.monadscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gold/60 hover:text-gold flex items-center gap-0.5"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              TX
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
