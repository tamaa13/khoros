/**
 * The Khoros mark — a chorus (χορός): a ring of agent-nodes around a single ball
 * panel, one lit gold. `full` shows all 8 nodes; `simple` shows 4 (small sizes).
 */
type Variant = "full" | "simple" | "mono";

export function Logo({ size = 40, variant = "full", className, float }: { size?: number; variant?: Variant; className?: string; float?: boolean }) {
  const mono = variant === "mono";
  const ring = mono ? "currentColor" : "#2A2D36";
  const gold = mono ? "currentColor" : "#F4C44C";
  const deep = mono ? "currentColor" : "#C49A33";
  const style = float ? { animation: "float 5s ease-in-out infinite" } : undefined;

  if (variant === "simple") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" className={className} style={style}>
        <circle cx="50" cy="50" r="36" stroke={ring} strokeWidth="4" />
        <circle cx="50" cy="14" r="8" fill={gold} />
        <circle cx="86" cy="50" r="7" fill={gold} />
        <circle cx="50" cy="86" r="7" fill={gold} />
        <circle cx="14" cy="50" r="7" fill={gold} />
        <polygon points="50,34 65.22,45.06 59.4,62.94 40.6,62.94 34.78,45.06" fill={gold} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" className={className} style={mono ? { color: "#0D0E12", ...style } : style}>
      <circle cx="50" cy="50" r="36" stroke={ring} strokeWidth="2" opacity={mono ? 0.22 : 1} />
      <circle cx="50" cy="14" r="6.2" fill={gold} />
      <circle cx="75.45" cy="24.55" r="5.5" fill={gold} opacity={mono ? 0.85 : 1} />
      <circle cx="86" cy="50" r="5.5" fill={gold} opacity={mono ? 0.85 : 1} />
      <circle cx="75.45" cy="75.45" r="5.5" fill={deep} opacity={mono ? 0.5 : 1} />
      <circle cx="50" cy="86" r="5.5" fill={gold} opacity={mono ? 0.85 : 1} />
      <circle cx="24.55" cy="75.45" r="5.5" fill={deep} opacity={mono ? 0.5 : 1} />
      <circle cx="14" cy="50" r="5.5" fill={gold} opacity={mono ? 0.85 : 1} />
      <circle cx="24.55" cy="24.55" r="5.5" fill={gold} opacity={mono ? 0.85 : 1} />
      <polygon points="50,34 65.22,45.06 59.4,62.94 40.6,62.94 34.78,45.06" fill={gold} />
    </svg>
  );
}

/** The tiny agent-avatar glyph (just the ball panel) used on chat bubbles/chips. */
export function AgentGlyph({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        background: "radial-gradient(circle at 35% 30%,#2A2412,#14110A)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
    >
      <svg viewBox="0 0 100 100" width={size * 0.54} height={size * 0.54} fill="none">
        <polygon points="50,30 70,45 62,68 38,68 30,45" fill="#F4C44C" />
      </svg>
    </span>
  );
}
