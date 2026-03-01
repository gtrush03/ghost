import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { shortenAddress } from "../lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  walletAddress?: string | null;
  prefillMessage?: string;
}

export function ChatInput({ onSend, disabled, walletAddress, prefillMessage }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle prefill from settings panel CTAs
  useEffect(() => {
    if (prefillMessage) {
      setValue(prefillMessage);
      inputRef.current?.focus();
    }
  }, [prefillMessage]);

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <div className="p-3 border-t border-glass-border">
      <div className="flex items-center gap-2 bg-glass rounded-xl px-3 py-2 border border-glass-border focus-within:border-gold-dim/30 transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Ask Ghost anything..."
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="w-8 h-8 rounded-lg gold-gradient-bg flex items-center justify-center
                     disabled:opacity-30 disabled:cursor-not-allowed
                     hover:opacity-90 transition-opacity cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5 text-obsidian" />
        </button>
      </div>
      {walletAddress && (
        <div className="mt-1 px-1 text-[10px] text-text-muted font-mono">
          Connected as {shortenAddress(walletAddress)}
        </div>
      )}
    </div>
  );
}
