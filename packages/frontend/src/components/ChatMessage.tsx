import { motion } from "framer-motion";
import { User } from "lucide-react";
import { GhostLogo } from "./GhostLogo";
import type { ChatMessage as ChatMessageType } from "../lib/types";
import { parseMarkdown } from "../lib/utils";
import { ToolCallStep } from "./ToolCallStep";
import { ConfirmationCard } from "./ConfirmationCard";

interface ChatMessageProps {
  message: ChatMessageType;
  onConfirm?: (actionId: string) => void;
  onReject?: (actionId: string) => void;
}

/** Detect if a message content looks like an error */
function isErrorMessage(content: string): boolean {
  return /^(error:|action failed:|confirmation failed:|swap failed:|transaction reverted)/i.test(content.trim())
    || /the dex router needs more mon/i.test(content)
    || /session expired/i.test(content);
}

export function ChatMessage({ message, onConfirm, onReject }: ChatMessageProps) {
  const isUser = message.role === "user";
  const displayText = message.isStreaming
    ? message.streamedContent ?? ""
    : message.content;

  const showAsError = !isUser && displayText && isErrorMessage(displayText);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 px-4 py-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-glass border border-glass-border flex items-center justify-center shrink-0 mt-0.5">
          <GhostLogo className="w-4 h-4" variant="gold-dim" />
        </div>
      )}

      <div className={`max-w-[85%] space-y-1 ${isUser ? "items-end" : "items-start"}`}>
        {/* Tool calls */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="rounded-xl bg-glass/50 border border-glass-border py-1 mb-1">
            {message.toolCalls.map((tool, i) => (
              <ToolCallStep key={`${tool.name}-${i}`} tool={tool} />
            ))}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-glass border border-gold-dim/20 text-text-primary"
              : showAsError
                ? "bg-red-500/5 border border-red-500/20 text-red-300"
                : "bg-glass border border-glass-border text-text-secondary"
          }`}
        >
          {displayText && (
            <div
              className="prose-ghost"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(displayText) }}
            />
          )}
          {message.isStreaming && (
            <span
              className="inline-block w-0.5 h-4 bg-gold ml-0.5 align-middle"
              style={{ animation: "cursor-blink 0.8s ease-in-out infinite" }}
            />
          )}
        </div>

        {/* Confirmation card for pending actions */}
        {!isUser && message.pendingAction && onConfirm && onReject && (
          <ConfirmationCard
            action={message.pendingAction}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-gold/10 border border-gold-dim/20 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-gold" />
        </div>
      )}
    </motion.div>
  );
}
