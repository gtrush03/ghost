import { Target, TrendingUp, BarChart3 } from "lucide-react";

interface StrategyRule {
  id: number;
  ruleType: string;
  tokenSymbol: string | null;
  targetPct: number | null;
  triggerPrice: number | null;
  triggerDirection: string | null;
  triggerAction: string | null;
  triggerAmountPct: number | null;
  thresholdPct: number | null;
  createdAt: string;
}

interface StrategyRuleCardProps {
  rule: StrategyRule;
  onAskAgent: (message: string) => void;
}

const TYPE_ICONS: Record<string, typeof Target> = {
  allocation: Target,
  price_trigger: TrendingUp,
  rebalance_threshold: BarChart3,
};

const TYPE_LABELS: Record<string, string> = {
  allocation: "Allocation Target",
  price_trigger: "Price Trigger",
  rebalance_threshold: "Rebalance Threshold",
};

export function StrategyRuleCard({ rule, onAskAgent }: StrategyRuleCardProps) {
  const Icon = TYPE_ICONS[rule.ruleType] ?? Target;

  let description = "";
  switch (rule.ruleType) {
    case "allocation":
      description = `Target ${rule.targetPct}% ${rule.tokenSymbol}`;
      break;
    case "price_trigger":
      description = `${rule.triggerAction} ${rule.tokenSymbol} when price ${rule.triggerDirection} $${rule.triggerPrice} (${rule.triggerAmountPct}% of treasury)`;
      break;
    case "rebalance_threshold":
      description = `Rebalance ${rule.tokenSymbol} when drift > ${rule.thresholdPct}%`;
      break;
  }

  return (
    <div className="p-2.5 rounded-lg border border-glass-border bg-glass">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Icon className="w-3 h-3 text-purple-400" />
        </div>
        <span className="text-[10px] font-medium text-text-secondary uppercase">
          {TYPE_LABELS[rule.ruleType] ?? rule.ruleType}
        </span>
        <span className="text-[10px] text-text-muted ml-auto">#{rule.id}</span>
      </div>
      <p className="text-xs text-text-primary mb-1.5">{description}</p>
      <button
        onClick={() => onAskAgent(`Deactivate strategy rule #${rule.id}`)}
        className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors cursor-pointer"
      >
        Ask Ghost to remove
      </button>
    </div>
  );
}
