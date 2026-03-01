import { Router } from "express";
import { ensureMember, getMember, getMembersWithPower, getVotingPower, getDepositsForMember, logActivity } from "../services/db.js";

export function createMembersRouter(): Router {
  const router = Router();

  // Register a wallet as a member
  router.post("/register", (req, res) => {
    const { wallet, displayName } = req.body;
    if (!wallet || typeof wallet !== "string") {
      return res.status(400).json({ error: "wallet is required" });
    }

    const member = ensureMember(wallet, displayName);
    const votingPower = getVotingPower(wallet);

    logActivity({
      eventType: "member_joined",
      actorWallet: wallet,
      summary: `New member joined: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
      details: { wallet, displayName },
      privacy: "public",
    });

    return res.json({ member, votingPower });
  });

  // List all members with shares and voting power
  router.get("/", (_req, res) => {
    const members = getMembersWithPower();
    return res.json({ members });
  });

  // Get a specific member by wallet
  router.get("/:wallet", (req, res) => {
    const member = getMember(req.params.wallet);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const votingPower = getVotingPower(req.params.wallet);
    const deposits = getDepositsForMember(member.id);

    return res.json({ member, votingPower, deposits });
  });

  return router;
}
