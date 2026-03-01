import { Router } from "express";
import { getActiveStrategyRules, getAutonomousTradeHistory } from "../services/db.js";
import { getStrategyStatus } from "../agent/strategy.js";

export function createStrategyRouter(): Router {
  const router = Router();

  router.get("/rules", (_req, res) => {
    const rules = getActiveStrategyRules();
    return res.json({ rules });
  });

  router.get("/history", (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 100);
    const history = getAutonomousTradeHistory(limit);
    return res.json({ history });
  });

  router.get("/status", (_req, res) => {
    const status = getStrategyStatus();
    return res.json(status);
  });

  return router;
}
