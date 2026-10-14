// Tally mascot — hand-drawn SVG tally marks in a price-tag badge.
export function Mascot({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" role="img" aria-label="Tally mascot">
      <path d="M14 10h38l8 8v42a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" fill="#1a7f37" />
      <circle cx="20" cy="18" r="3" fill="#fff" />
      <g stroke="#fff" strokeWidth="4" strokeLinecap="round">
        <line x1="24" y1="32" x2="24" y2="52" />
        <line x1="32" y1="32" x2="32" y2="52" />
        <line x1="40" y1="32" x2="40" y2="52" />
        <line x1="48" y1="32" x2="48" y2="52" />
        <line x1="20" y1="46" x2="52" y2="36" />
      </g>
    </svg>
  );
}
