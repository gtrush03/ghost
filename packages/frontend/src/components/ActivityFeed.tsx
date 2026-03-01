import { AnimatePresence } from "framer-motion";
import type { ActivityItem } from "../lib/types";
import { ActivityEntry } from "./ActivityEntry";

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="glass-card p-5 flex flex-col" style={{ maxHeight: "340px" }}>
      <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
        Activity Log
      </h2>
      <div className="overflow-y-auto flex-1 space-y-0.5">
        {activities.length === 0 ? (
          <p className="text-xs text-text-muted py-2">No activity yet. Send a message to the agent to get started.</p>
        ) : (
          <AnimatePresence initial={false}>
            {activities.map((item) => (
              <ActivityEntry key={item.id} item={item} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
