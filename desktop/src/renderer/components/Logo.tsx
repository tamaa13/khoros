/**
 * The Khoros mark — a chorus (χορός) drawn literally: the football's pentagon
 * panel formed AS a network of agents. Five nodes joined by thin edges inside
 * the ball; one node lit gold (your agent). The society IS the ball.
 */
type Variant = "full" | "simple" | "mono";

// pentagon vertices, r=26 around (50,50), top-first
const P = [
  [50, 24],
  [74.7, 42],
  [65.3, 71],
  [34.7, 71],
  [25.3, 42],
] as const;
const EDGES = P.map((_, i) => `${P[i]![0]},${P[i]![1]} ${P[(i + 1) % 5]![0]},${P[(i + 1) % 5]![1]}`);

export function Logo({ size = 40, variant = "full", className, float }: { size?: number; variant?: Variant; className?: string; float?: boolean }) {
  const mono = variant === "mono";
  const small = variant === "simple";
  const ball = mono ? "currentColor" : "rgb(var(--c2a2d36))";
  const edge = mono ? "currentColor" : "rgb(var(--c50545e))";
  const node = mono ? "currentColor" : "rgb(var(--cc9cdd6))";
  const gold = mono ? "currentColor" : "rgb(var(--cf4c44c))";
  const style = float ? { animation: "float 5s ease-in-out infinite" } : undefined;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" className={className} style={style}>
      <circle cx="50" cy="50" r="41" stroke={ball} strokeWidth={small ? 6 : 4} opacity={mono ? 0.35 : 1} />
      {EDGES.map((pts, i) => (
        <polyline key={i} points={pts} stroke={edge} strokeWidth={small ? 4 : 3} opacity={mono ? 0.5 : 0.9} />
      ))}
      {P.map(([x, y], i) =>
        i === 0 ? (
          <circle key={i} cx={x} cy={y} r={small ? 10 : 8.5} fill={gold} />
        ) : (
          <circle key={i} cx={x} cy={y} r={small ? 7.5 : 6.5} fill={node} opacity={mono ? 0.75 : 1} />
        ),
      )}
    </svg>
  );
}

/** The tiny agent-avatar glyph — one node of the chorus: a lit member inside
 *  its orbit. Used on chat bubbles, crew cards and chips. */
export function AgentGlyph({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        background: "radial-gradient(circle at 35% 30%,rgb(var(--c2a2412)),rgb(var(--c14110a)))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
        <circle cx="50" cy="50" r="34" stroke="rgb(var(--c3a3320))" strokeWidth="6" />
        <circle cx="50" cy="50" r="15" fill="rgb(var(--cf4c44c))" />
        <circle cx="50" cy="16" r="9" fill="rgb(var(--cc49a33))" />
      </svg>
    </span>
  );
}
