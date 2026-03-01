import { Router } from "express";
import { getConstraints } from "../agent/validator.js";
import { getRecentSettingsChanges, getPoolStats } from "../services/db.js";

export function createSettingsRouter(): Router {
  const router = Router();

  // Get current constraints + governance info + recent changes
  router.get("/", (_req, res) => {
    const constraints = getConstraints();
    const recentChanges = getRecentSettingsChanges(10);
    const stats = getPoolStats();

    return res.json({
      constraints,
      governance: {
        requiredPower: 0.51,
        totalMembers: stats.activeMembers,
        netPoolUsd: stats.netPoolUsd,
      },
      recentChanges,
    });
  });

  return router;
}
