import { useState, useCallback } from "react";
import type { ActivityItem, AgentEvent } from "../lib/types";
import { TOOL_DISPLAY_NAMES } from "../lib/constants";
import { generateId } from "../lib/utils";

export function useActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const addFromEvents = useCallback((events: AgentEvent[]) => {
    const newItems: ActivityItem[] = [];

    for (const event of events) {
      if (event.type === "tool_call" && event.name) {
        const privacy: ActivityItem["privacy"] =
          event.name === "get_price" ? "burner" : "private";

        newItems.push({
          id: generateId(),
          timestamp: new Date().toISOString(),
          type: event.name === "get_price" ? "x402_payment"
            : event.name === "execute_swap" ? "swap"
            : event.name === "check_balance" ? "constraint_check"
            : "chat",
          description: TOOL_DISPLAY_NAMES[event.name] ?? event.name,
          privacy,
        });
      }
    }

    if (newItems.length > 0) {
      setActivities((prev) => [...newItems, ...prev].slice(0, 20));
    }
  }, []);

  const addEntry = useCallback((entry: Omit<ActivityItem, "id" | "timestamp">) => {
    setActivities((prev) =>
      [{ ...entry, id: generateId(), timestamp: new Date().toISOString() }, ...prev].slice(0, 20)
    );
  }, []);

  return { activities, addFromEvents, addEntry };
}
