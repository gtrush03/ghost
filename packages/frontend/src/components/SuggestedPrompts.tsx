import { Ghost } from "lucide-react";
import { motion } from "framer-motion";
import { SUGGESTED_PROMPTS } from "../lib/constants";

interface SuggestedPromptsProps {
  onSelect: (message: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center gap-6 max-w-md"
      >
        <div className="w-16 h-16 rounded-2xl bg-glass border border-glass-border flex items-center justify-center">
          <Ghost className="w-8 h-8 text-gold" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">
            Ghost Treasury Agent
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Private AI treasury manager. Ask me about balances, trades, or our privacy model.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <motion.button
              key={prompt.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 * i }}
              onClick={() => onSelect(prompt.message)}
              className="px-3.5 py-2 rounded-xl bg-glass border border-glass-border text-xs text-text-secondary
                         hover:bg-glass-hover hover:text-text-primary hover:border-gold-dim/30
                         transition-all duration-200 cursor-pointer"
            >
              {prompt.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
