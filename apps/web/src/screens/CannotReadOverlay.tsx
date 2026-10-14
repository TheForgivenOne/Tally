/** Shown after repeated read failures: guides the camera to the barcode. */
export function CannotReadOverlay({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="cannot-read-title">
      <div className="overlay-card">
        <svg width="200" height="120" viewBox="0 0 200 120" role="img" aria-label="Diagram: point the camera at the barcode on the shelf tag">
          <rect x="8" y="8" width="184" height="104" rx="8" fill="#f2f5f1" stroke="#4d4d4d" />
          <rect x="24" y="24" width="120" height="20" fill="#4d4d4d" />
          <rect x="24" y="50" width="80" height="10" fill="#4d4d4d" />
          <g aria-hidden="true">
            <rect x="24" y="70" width="3" height="30" fill="#1b1b1b" />
            <rect x="29" y="70" width="2" height="30" fill="#1b1b1b" />
            <rect x="33" y="70" width="5" height="30" fill="#1b1b1b" />
            <rect x="40" y="70" width="2" height="30" fill="#1b1b1b" />
            <rect x="44" y="70" width="4" height="30" fill="#1b1b1b" />
            <rect x="50" y="70" width="2" height="30" fill="#1b1b1b" />
            <rect x="54" y="70" width="6" height="30" fill="#1b1b1b" />
            <rect x="62" y="70" width="3" height="30" fill="#1b1b1b" />
          </g>
          <rect x="16" y="62" width="140" height="46" rx="4" fill="none" stroke="#1a7f37" strokeWidth="3" strokeDasharray="6 4" />
        </svg>
        <h2 id="cannot-read-title">Can&apos;t read that tag</h2>
        <p>Point the camera inside the green frame, at the barcode on the shelf edge. Glare is the usual culprit — tilt the phone slightly.</p>
        <div className="basket-actions">
          <button type="button" className="primary" onClick={onRetry}>
            Try again
          </button>
          <button type="button" onClick={onClose}>
            Back to basket
          </button>
        </div>
      </div>
    </div>
  );
}
