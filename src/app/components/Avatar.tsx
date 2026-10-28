/** Initials in a coloured circle, so a list of names scans faster. The colour follows the name. */
export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="avatar" style={{ "--hue": hash } as React.CSSProperties} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}
