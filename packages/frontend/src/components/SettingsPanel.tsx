import { useState, useEffect } from "react";
import { Settings, Clock, Percent, Coins, MessageSquare } from "lucide-react";
import type { SettingsResponse } from "../lib/types";
import { fetchStrategyRules } from "../lib/api";
import { StrategyRuleCard } from "./StrategyRuleCard";

interface SettingsPanelProps {
  settings: SettingsResponse;
  onAskAgent: (message: string) => void;
}

export function SettingsPanel({ settings, onAskAgent }: SettingsPanelProps) {
  const { constraints, governance } = settings;
  const [rules, setRules] = useState<any[]>([]);
  useEffect(() => {
    fetchStrategyRules().then((data) => setRules(data.rules));
  }, []);

  return (
    <div className="space-y-3">
      {/* Max Trade Size */}
      <div className="p-3 rounded-lg border border-glass-border bg-glass">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Percent className="w-3.5 h-3.5 text-gold-dim" />
            <span className="text-xs font-medium text-text-primary">Max Trade Size</span>
          </div>
          <span className="text-xs font-mono text-gold">{constraints.maxTradePct}%</span>
        </div>
        <p className="text-[10px] text-text-muted mb-2">
          Maximum single trade as percentage of treasury value
        </p>
        <button
          onClick={() => onAskAgent(`Change the max trade size to 15%`)}
          className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors cursor-pointer"
        >
          <MessageSquare className="w-3 h-3" />
          Ask Ghost to change
        </button>
      </div>

      {/* Cooldown */}
      <div className="p-3 rounded-lg border border-glass-border bg-glass">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gold-dim" />
            <span className="text-xs font-medium text-text-primary">Trade Cooldown</span>
          </div>
          <span className="text-xs font-mono text-gold">{constraints.cooldownMinutes} min</span>
        </div>
        <p className="text-[10px] text-text-muted mb-2">
          Minimum time between consecutive trades
        </p>
        <button
          onClick={() => onAskAgent(`Change the trade cooldown to 10 minutes`)}
          className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors cursor-pointer"
        >
          <MessageSquare className="w-3 h-3" />
          Ask Ghost to change
        </button>
      </div>

      {/* Allowed Tokens */}
      <div className="p-3 rounded-lg border border-glass-border bg-glass">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Coins className="w-3.5 h-3.5 text-gold-dim" />
            <span className="text-xs font-medium text-text-primary">Allowed Tokens</span>
          </div>
          <span className="text-xs font-mono text-text-secondary">{constraints.allowedTokens.length} tokens</span>
        </div>
        <p className="text-[10px] text-text-muted">
          USDC, WMON/ETH, MON
        </p>
      </div>

      {/* Paused Status */}
      <div className={`p-3 rounded-lg border ${constraints.paused ? "border-warning/30 bg-warning/5" : "border-glass-border bg-glass"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-gold-dim" />
            <span className="text-xs font-medium text-text-primary">Trading Status</span>
          </div>
          <span className={`text-xs font-medium ${constraints.paused ? "text-warning" : "text-success"}`}>
            {constraints.paused ? "Paused" : "Active"}
          </span>
        </div>
        {constraints.paused && (
          <button
            onClick={() => onAskAgent(`Unpause trading`)}
            className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3 h-3" />
            Ask Ghost to unpause
          </button>
        )}
      </div>

      {/* Governance Info */}
      <div className="p-3 rounded-lg border border-glass-border bg-glass">
        <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
          Governance Rules
        </h3>
        <p className="text-[10px] text-text-secondary">
          Settings changes require {(governance.requiredPower * 100).toFixed(0)}% voting power.
          Talk to the agent to propose changes.
        </p>
      </div>

      {/* Strategy Rules */}
      <div className="p-3 rounded-lg border border-glass-border bg-glass">
        <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
          Strategy Rules
        </h3>
        {rules.length === 0 ? (
          <p className="text-[10px] text-text-secondary">
            No active strategy rules. Ask Ghost to set up autonomous trading.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <StrategyRuleCard key={rule.id} rule={rule} onAskAgent={onAskAgent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
