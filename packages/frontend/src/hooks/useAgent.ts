import { useState, useCallback, useRef } from "react";
import type { ChatMessage, DisplayToolCall, AgentEvent } from "../lib/types";
import { sendChatMessage } from "../lib/api";
import { TOOL_DISPLAY_NAMES } from "../lib/constants";
import { generateId } from "../lib/utils";

interface UseAgentOptions {
  onComplete?: (events: AgentEvent[]) => void;
  walletAddress?: string;
}

export function useAgent({ onComplete, walletAddress }: UseAgentOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const abortRef = useRef(false);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isProcessing || !text.trim()) return;

      setHasInteracted(true);
      setIsProcessing(true);
      abortRef.current = false;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);

      try {
        const data = await sendChatMessage(text.trim(), walletAddress);

        // Build tool calls for display
        const toolCalls: DisplayToolCall[] = (data.toolCalls ?? []).map((tc) => ({
          name: tc.name,
          displayName: TOOL_DISPLAY_NAMES[tc.name] ?? tc.name,
          input: tc.input,
          result: tc.result,
          status: "running" as const,
          duration: undefined,
          cost: tc.name === "get_price" ? "$0.001" : undefined,
        }));

        const assistantId = generateId();

        // Add assistant message placeholder
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          isStreaming: true,
          streamedContent: "",
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Animate tool calls sequentially
        for (let i = 0; i < toolCalls.length; i++) {
          if (abortRef.current) break;

          await sleep(400);

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId || !m.toolCalls) return m;
              const updated = [...m.toolCalls];
              updated[i] = { ...updated[i], status: "complete", duration: 200 + Math.random() * 600 };
              return { ...m, toolCalls: updated };
            })
          );
        }

        // Simulate text streaming
        const fullText = data.response;
        const chunkSize = 3;
        let pos = 0;

        while (pos < fullText.length && !abortRef.current) {
          const end = Math.min(pos + chunkSize, fullText.length);
          const streamed = fullText.slice(0, end);
          pos = end;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, streamedContent: streamed, isStreaming: pos < fullText.length }
                : m
            )
          );

          await sleep(15);
        }

        // Finalize
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false, streamedContent: undefined }
              : m
          )
        );

        onComplete?.(data.events ?? []);
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: `Error: ${err.message}. The backend may be offline.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, onComplete, walletAddress]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasInteracted(false);
    abortRef.current = true;
  }, []);

  return { messages, isProcessing, hasInteracted, sendMessage, clearMessages };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
