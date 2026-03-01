import { motion } from "framer-motion";
import type { ActivityItem } from "../lib/types";
import { formatTimestamp } from "../lib/utils";

const PRIVACY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  private: { label: "PRIVATE", color: "text-success", bg: "bg-success/10 border-success/20" },
  burner: { label: "BURNER", color: "text-warning", bg: "bg-warning/10 border-warning/20" },
  public: { label: "PUBLIC", color: "text-text-muted", bg: "bg-glass border-glass-border" },
};

interface ActivityEntryProps {
  item: ActivityItem;
}

export function ActivityEntry({ item }: ActivityEntryProps) {
  const badge = PRIVACY_BADGE[item.privacy] ?? PRIVACY_BADGE.public;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-glass-hover transition-colors"
    >
      <span className="text-[10px] text-text-muted font-mono w-14 shrink-0">
        {formatTimestamp(item.timestamp)}
      </span>
      <span className="text-xs text-text-secondary flex-1 truncate">
        {item.description}
      </span>
      <span
        className={`text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.bg} ${badge.color}`}
      >
        {badge.label}
      </span>
    </motion.div>
  );
}
