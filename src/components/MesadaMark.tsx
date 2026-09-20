type Props = {
  size?: number;
  className?: string;
  /** Supply to give the mark an accessible name; omit to hide it decoratively. */
  title?: string;
};

/**
 * The Mesada mark: three stacked coins, drawn flat and straight-on.
 *
 * Deliberately NOT the 3D/perspective version from the design exploration —
 * perspective turns to mush at favicon size. Coin faces are blank: the app
 * handles USD, EUR and VES, so a currency glyph here would contradict the
 * product.
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
        <rect x="10" y="40" width="44" height="8" rx="4" fill="var(--text)" />
        <ellipse cx="32" cy="40" rx="22" ry="8" fill="var(--text)" />
      </g>

      {/* middle coin */}
      <g data-coin="middle">
        <rect x="10" y="28" width="44" height="8" rx="4" fill="var(--muted)" />
        <ellipse cx="32" cy="28" rx="22" ry="8" fill="var(--muted)" />
      </g>

      {/* top coin */}
      <g data-coin="top">
        <rect x="10" y="16" width="44" height="8" rx="4" fill="var(--positive)" />
        <ellipse cx="32" cy="16" rx="22" ry="8" fill="var(--positive)" />
      </g>
    </svg>
  );
}
