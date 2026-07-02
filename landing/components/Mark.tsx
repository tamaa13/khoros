/** The Khoros mark — the football's pentagon panel drawn as a network of
 *  agents; one node lit gold (yours). Same geometry as the desktop app. */
const P = [
  [50, 24],
  [74.7, 42],
  [65.3, 71],
  [34.7, 71],
  [25.3, 42],
] as const;

export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-hidden>
      <circle cx="50" cy="50" r="41" stroke="rgba(241,242,245,.22)" strokeWidth="4" />
      {P.map((_, i) => {
        const a = P[i]!;
        const b = P[(i + 1) % 5]!;
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="rgba(241,242,245,.35)" strokeWidth="3" />;
      })}
      {P.map(([x, y], i) => (i === 0 ? <circle key={i} cx={x} cy={y} r="8.5" fill="#F4C44C" /> : <circle key={i} cx={x} cy={y} r="6.5" fill="#A2A6AF" />))}
    </svg>
  );
}
