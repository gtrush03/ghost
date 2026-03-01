import { Router } from "express";
import { getActivityLog } from "../services/db.js";

export function createActivityRouter(): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 100);
    const offset = parseInt(String(req.query.offset)) || 0;
    const eventType = typeof req.query.type === "string" ? req.query.type : undefined;

    const activities = getActivityLog({ limit, offset, eventType });
    return res.json({ activities, limit, offset });
  });

  return router;
}
