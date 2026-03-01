import { ArrowDownToLine, Vote, Bot, ArrowUpFromLine } from "lucide-react";
import { motion } from "framer-motion";

interface OnboardingFlowProps {
  onDeposit?: () => void;
}

const STEPS = [
  { icon: ArrowDownToLine, title: "Deposit", description: "Fund the privacy pool with USDC or MON" },
  { icon: Vote, title: "Vote", description: "Earn voting power proportional to your share" },
  { icon: Bot, title: "Agent Trades", description: "Ghost executes private trades for the DAO" },
  { icon: ArrowUpFromLine, title: "Withdraw", description: "Withdraw your share anytime" },
];

export function OnboardingFlow({ onDeposit }: OnboardingFlowProps) {
  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
        Your Position
      </h3>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-3"
      >
        <p className="text-sm text-text-primary">
          You're connected! Here's how Ghost Treasury works:
        </p>

        <div className="grid grid-cols-2 gap-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.3 }}
                className="p-2.5 rounded-lg border border-glass-border bg-glass"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-gold-dim" />
                  <span className="text-[10px] font-medium text-text-primary">{step.title}</span>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">{step.description}</p>
              </motion.div>
            );
          })}
        </div>

        <button
          onClick={onDeposit}
          className="w-full py-2.5 rounded-lg font-medium text-xs transition-all cursor-pointer
                     bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30
                     flex items-center justify-center gap-2"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Deposit to Join
        </button>
      </motion.div>
    </div>
  );
}
