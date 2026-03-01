import { GhostLogo } from "./GhostLogo";

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <GhostLogo className="w-4 h-4" variant="gold-dim" />
      <span className="text-sm text-text-muted">Ghost is thinking</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gold-dim"
            style={{
              animation: "loading-pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
