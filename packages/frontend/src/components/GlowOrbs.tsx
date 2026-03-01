export function GlowOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="glow-orb glow-orb-1" style={{ top: "10%", left: "5%" }} />
      <div className="glow-orb glow-orb-2" style={{ top: "60%", right: "10%" }} />
      <div className="glow-orb glow-orb-3" style={{ bottom: "10%", left: "40%" }} />
    </div>
  );
}
