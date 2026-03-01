import { motion } from "framer-motion";

interface AllocationBarProps {
  symbol: string;
  amount: string;
  allocationPct: number;
  color: string;
  valueUsd: number;
}

function formatTokenAmount(amount: string, symbol: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0";
  // USDC: 2 decimals, others: trim trailing zeros but keep up to 4
  if (symbol === "USDC") return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function AllocationBar({ symbol, amount, allocationPct, color, valueUsd }: AllocationBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-text-primary font-medium">{symbol}</span>
          <span className="text-text-muted">{formatTokenAmount(amount, symbol)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-secondary">${valueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="text-text-muted">{allocationPct}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-glass rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${allocationPct}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </div>
    </div>
  );
}
