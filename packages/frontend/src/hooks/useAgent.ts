import { useState, useCallback, useRef } from "react";
import type { ChatMessage, DisplayToolCall, AgentEvent, PendingAction } from "../lib/types";
import { sendChatMessage, confirmAction as apiConfirmAction, rejectAction as apiRejectAction } from "../lib/api";
import { performSiwe } from "./useWallet";
import { TOOL_DISPLAY_NAMES } from "../lib/constants";
import { generateId } from "../lib/utils";

interface UseAgentOptions {
  onComplete?: (events: AgentEvent[]) => void;
  walletAddress?: string;
  authToken?: string | null;
}

/** Map raw error strings to user-friendly messages */
function friendlyError(raw: string): string {
  if (/fund.*router.*mon/i.test(raw) || /insufficient.*mon/i.test(raw)) {
    return "The DEX router needs more MON to execute this swap. An admin should fund it.";
  }
  if (/authentication|unauthorized|401/i.test(raw)) {
    return "Session expired. Please reconnect your wallet to re-authenticate.";
  }
  if (/revert/i.test(raw)) {
    return `Transaction reverted: ${raw.replace(/.*revert\s*/i, "").slice(0, 200)}`;
  }
  if (/timeout|ETIMEDOUT/i.test(raw)) {
    return "The request timed out. The agent may be busy — try again in a moment.";
  }
  if (/network error/i.test(raw)) {
    return "Cannot reach the backend. Make sure the server is running.";
  }
  return raw;
}

export function useAgent({ onComplete, walletAddress, authToken }: UseAgentOptions = {}) {
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

        // Detect pending action from tool call results
        let pendingAction: PendingAction | undefined;
        for (const tc of data.toolCalls ?? []) {
          const result = tc.result as any;
          if (result?.proposed === true && result?.actionId) {
            pendingAction = {
              actionId: result.actionId,
              type: result.action ?? "swap",
              message: result.message ?? "",
              params: tc.input,
              expiresIn: result.expiresIn ?? "5 minutes",
              from: result.from,
              to: result.to,
              amount: result.amount,
              amountUsd: result.amountUsd,
            };
            break;
          }
        }

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
          pendingAction,
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
          content: friendlyError(err.message),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, onComplete, walletAddress]
  );

  const handleConfirmAction = useCallback(
    async (actionId: string) => {
      // Build a retry auth function that re-runs SIWE
      const retryAuth = walletAddress
        ? () => performSiwe(walletAddress)
        : undefined;

      try {
        const result = await apiConfirmAction(actionId, retryAuth);
        const resultMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: formatActionResult(result.result),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, resultMsg]);
        onComplete?.([]); // Trigger refresh
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: friendlyError(`Confirmation failed: ${err.message}`),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    },
    [onComplete, walletAddress]
  );

  const handleRejectAction = useCallback(
    async (actionId: string) => {
      try {
        await apiRejectAction(actionId);
        const rejectMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: "Action rejected. No changes were made.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, rejectMsg]);
      } catch (err: any) {
        console.warn("[agent] Reject failed:", err.message);
      }
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasInteracted(false);
    abortRef.current = true;
  }, []);

  return {
    messages,
    isProcessing,
    hasInteracted,
    sendMessage,
    clearMessages,
    confirmAction: handleConfirmAction,
    rejectAction: handleRejectAction,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatActionResult(result: unknown): string {
  if (!result || typeof result !== "object") return "Action completed.";
  const r = result as Record<string, unknown>;

  if (r.executed === true) {
    if (r.from && r.to) {
      return `Swap executed: ${r.amount} ${r.from} → ${r.to}. ${r.txHash ? `TX: ${String(r.txHash).slice(0, 14)}...` : ""} ${r.privacy === "fully_private" ? "Fully private." : ""}`.trim();
    }
    if (r.token) {
      return `Withdrawal executed: ${r.amount} ${r.token}. ${r.txHash ? `TX: ${String(r.txHash).slice(0, 14)}...` : ""}`.trim();
    }
    return "Action executed successfully.";
  }

  if (r.success === true) {
    return `Setting updated: ${r.setting} changed from ${r.oldValue} to ${r.newValue}.`;
  }

  if (r.executed === false || r.success === false) {
    const rawReason = String(r.reason || r.error || "Unknown error");
    return friendlyError(`Action failed: ${rawReason}`);
  }

  return "Action completed.";
}
