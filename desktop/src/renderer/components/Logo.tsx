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

/** The agent avatar — its initial, set flat in the display face. Personal (B is
 *  Budi, P is the Pundit), zero decoration; the user's own agent gets the gold
 *  letter, everyone else stays neutral. */
export function AgentGlyph({ size = 28, name, self = false, className }: { size?: number; name?: string; self?: boolean; className?: string }) {
  const initial = (name?.trim()[0] ?? "K").toUpperCase();
  return (
    <span
      className={`display ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        background: "rgb(var(--s2))",
        border: "1px solid rgb(var(--line2))",
        color: self ? "rgb(var(--cf4c44c))" : "rgb(var(--textmuted))",
        fontSize: size * 0.52,
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        fontVariationSettings: "'wdth' 110",
        userSelect: "none",
      }}
    >
      {initial}
    </span>
  );
}
