import { useEffect, useRef, useState } from 'react';
import { useShop } from '../basket.js';
import { BudgetBar } from '../components/BudgetBar.js';
import { Mascot } from '../components/Mascot.js';
import { isOnline, subscribeOnline } from '../offline/sync.js';

type CameraState = 'starting' | 'live' | 'unavailable';

/** Shopping screen: live camera, pinned total, capture. Photo read lands in step 5. */
export function Shopping() {
  const { go, dispatch } = useShop();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [captureNote, setCaptureNote] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean>(() => isOnline());

  useEffect(() => subscribeOnline(() => setOnline(isOnline())), []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera API');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCamera('live');
      } catch {
        if (!cancelled) setCamera('unavailable');
      }
    }
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <main className="screen screen-shopping">
      <BudgetBar />
      {!online && (
        <p role="status" className="cache-note">
          Offline — showing cached prices. Reports will sync when you reconnect.
        </p>
      )}
      <div className="viewfinder">
        {camera === 'live' ? (
          <video ref={videoRef} playsInline muted aria-label="Live camera view of the shelf" />
        ) : camera === 'starting' ? (
          <p role="status">Starting camera…</p>
        ) : (
          <p role="status" className="camera-fallback">
            Camera unavailable here. Price capture needs a phone camera — everything else works.
          </p>
        )}
        {/* Camera ref must mount in every state so the effect can attach the stream. */}
        {camera !== 'live' && <video ref={videoRef} playsInline muted hidden aria-hidden="true" />}
        <Mascot size={48} />
      </div>
      <div className="capture-row">
        <button
          type="button"
          className="primary capture"
          onClick={() => {
            // Step 5 wires this to photo capture + price resolution. Demo add keeps
            // the basket loop testable end to end today.
            dispatch({
              type: 'add',
              line: {
                barcode: '012345678905',
                name: 'Tastee Cheese 250g',
                priceMinor: 125000,
                source: 'tag',
                observedAt: new Date().toISOString(),
                confidence: 0.95,
              },
            });
            setCaptureNote('Captured — automatic price read lands in step 5.');
          }}
        >
          Capture price
        </button>
        <button type="button" onClick={() => go('basket')}>
          Basket
        </button>
      </div>
      {captureNote !== null && (
        <p role="status" className="capture-note">
          {captureNote}
        </p>
      )}
    </main>
  );
}
