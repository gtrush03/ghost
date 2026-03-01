interface GhostLogoProps {
  className?: string;
  /** "gold" | "gold-dim" | "white" — controls the color filter applied to the black PNG */
  variant?: "gold" | "gold-dim" | "white";
}

// CSS filter chains to colorize a black PNG
// Generated via: https://codepen.io/sosuke/pen/Pjoqqp
const FILTERS: Record<string, string> = {
  // #928466 (gold)
  gold: "brightness(0) saturate(100%) invert(55%) sepia(12%) saturate(748%) hue-rotate(6deg) brightness(90%) contrast(87%)",
  // #6b6350 (gold-dim)
  "gold-dim": "brightness(0) saturate(100%) invert(40%) sepia(8%) saturate(950%) hue-rotate(10deg) brightness(92%) contrast(85%)",
  // white
  white: "brightness(0) invert(1)",
};

export function GhostLogo({ className = "w-5 h-5", variant = "gold" }: GhostLogoProps) {
  return (
    <img
      src="/ghost-logo.png"
      alt=""
      className={className}
      draggable={false}
      style={{ filter: FILTERS[variant] ?? FILTERS.gold, objectFit: "contain" }}
    />
  );
}
