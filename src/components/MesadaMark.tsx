type Props = {
  size?: number;
  className?: string;
  /** Supply to give the mark an accessible name; omit to hide it decoratively. */
  title?: string;
};

/**
 * The Mesada mark: three stacked coins, drawn flat and straight-on.
 *
 * Each coin is a lighter elliptical top face over a darker rectangular/
 * elliptical body, so the coin's thickness shows edge-on — that thickness is
 * what reads as "coin" rather than "slab". This is flat 2-tone shading, not
 * 3D or perspective (perspective turns to mush at favicon size). Coin faces
 * are blank: the app handles USD, EUR and VES, so a currency glyph here
 * would contradict the product.
 *
 * Uses CSS custom properties, not useTheme(), because ThemeProvider sits
 * inside AuthGate — Login and Signup render outside it.
 */
export default function MesadaMark({ size = 24, className, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}

      {/* bottom coin */}
      <g data-coin="bottom">
        <rect x="15" y="38" width="34" height="7" fill="var(--text)" />
        <ellipse cx="32" cy="45" rx="17" ry="6" fill="var(--text)" />
        <ellipse cx="32" cy="38" rx="17" ry="6" fill="var(--muted)" />
      </g>

      {/* middle coin */}
      <g data-coin="middle">
        <rect x="15" y="29" width="34" height="7" fill="var(--text)" />
        <ellipse cx="32" cy="36" rx="17" ry="6" fill="var(--text)" />
        <ellipse cx="32" cy="29" rx="17" ry="6" fill="var(--muted)" />
      </g>

      {/* top coin */}
      <g data-coin="top">
        <rect x="15" y="20" width="34" height="7" fill="var(--positive-shade)" />
        <ellipse cx="32" cy="27" rx="17" ry="6" fill="var(--positive-shade)" />
        <ellipse cx="32" cy="20" rx="17" ry="6" fill="var(--positive)" />
      </g>
    </svg>
  );
}
