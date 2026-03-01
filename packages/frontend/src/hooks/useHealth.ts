import { useState, useEffect, useRef } from "react";
import type { HealthInfo } from "../lib/types";
import { fetchHealth } from "../lib/api";

export function useHealth() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [isLive, setIsLive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const check = () => {
      fetchHealth()
        .then((data) => {
          setHealth(data);
          setIsLive(true);
        })
        .catch(() => {
          setIsLive(false);
        });
    };

    // Check immediately
    check();

    // Re-check every 10 seconds so we recover if backend restarts
    intervalRef.current = setInterval(check, 10_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    isLive,
    brain: health?.brain ?? "offline",
    model: health?.model ?? "unknown",
    health,
  };
}
