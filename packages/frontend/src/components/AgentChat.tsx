import { useRef, useEffect } from "react";
import { Ghost, Trash2 } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "../lib/types";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { clearChatHistory } from "../lib/api";

interface AgentChatProps {
  messages: ChatMessageType[];
  isProcessing: boolean;
  hasInteracted: boolean;
  onSend: (message: string) => void;
  onClear: () => void;
  model?: string;
  walletAddress?: string | null;
  mySharePercent?: number;
  prefillMessage?: string;
}

export function AgentChat({
  messages,
  isProcessing,
  hasInteracted,
  onSend,
  onClear,
  model,
  walletAddress,
  mySharePercent,
  prefillMessage,
}: AgentChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleClear = () => {
    clearChatHistory().catch(() => {});
    onClear();
  };

  return (
    <div className="glass-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <Ghost className="w-4 h-4 text-gold" />
          <span className="text-sm font-medium text-text-primary">Ghost Agent</span>
          {model && model !== "unknown" && (
            <span className="text-[10px] text-text-muted font-mono">{model}</span>
          )}
          {walletAddress && mySharePercent !== undefined && mySharePercent > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-medium">
              Your share: {mySharePercent.toFixed(1)}%
            </span>
          )}
        </div>
        {hasInteracted && (
          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg hover:bg-glass-hover transition-colors cursor-pointer"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-text-secondary" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {!hasInteracted ? (
          <SuggestedPrompts onSelect={onSend} />
        ) : (
          <div className="py-3 space-y-1">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isProcessing && messages[messages.length - 1]?.role === "user" && (
              <ThinkingIndicator />
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSend}
        disabled={isProcessing}
        walletAddress={walletAddress ?? null}
        prefillMessage={prefillMessage}
      />
    </div>
  );
}
