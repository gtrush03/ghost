import { useState, useEffect } from "react";
import type { HealthInfo } from "../lib/types";
import { fetchHealth } from "../lib/api";

export function useHealth() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealth(data);
        setIsLive(true);
      })
      .catch(() => {
        setIsLive(false);
      });
  }, []);

  return {
    isLive,
    brain: health?.brain ?? "offline",
    model: health?.model ?? "unknown",
    health,
  };
}
