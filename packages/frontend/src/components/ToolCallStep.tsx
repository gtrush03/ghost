import { CheckCircle2, Loader2 } from "lucide-react";
import type { DisplayToolCall } from "../lib/types";

interface ToolCallStepProps {
  tool: DisplayToolCall;
}

export function ToolCallStep({ tool }: ToolCallStepProps) {
  const isRunning = tool.status === "running";

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 text-xs">
      {isRunning ? (
        <Loader2
          className="w-3.5 h-3.5 text-gold-dim shrink-0"
          style={{ animation: "spin 1s linear infinite" }}
        />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
      )}

      <span className={isRunning ? "text-text-muted" : "text-text-secondary"}>
        {tool.displayName}
      </span>

      {tool.duration != null && (
        <span className="text-text-muted font-mono text-[10px]">
          {Math.round(tool.duration)}ms
        </span>
      )}

      {tool.cost && (
        <span className="text-[10px] font-mono text-warning/70 px-1 py-0.5 rounded bg-warning/5 border border-warning/10">
          {tool.cost}
        </span>
      )}
    </div>
  );
}
