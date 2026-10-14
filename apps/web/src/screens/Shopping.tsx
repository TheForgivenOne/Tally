import { useEffect, useRef, useState } from 'react';
import { useShop } from '../basket.js';
import { BudgetBar } from '../components/BudgetBar.js';
import { Mascot } from '../components/Mascot.js';
import { isOnline, subscribeOnline } from '../offline/sync.js';
import { DetectorScanner, type BarcodeScanner } from '../scan.js';
import { CannotReadOverlay } from './CannotReadOverlay.js';
import { captureFlow, type ResolvedItem, type TagItem } from './captureFlow.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';
const MAX_DIMENSION = 1024;
/** Consecutive failures before the guided overlay appears. */
const OVERLAY_AFTER_FAILURES = 2;

async function captureFrame(video: HTMLVideoElement): Promise<string | null> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width === 0 || height === 0) return null;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  if (!blob) return null;
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type CameraState = 'starting' | 'live' | 'unavailable';

/** Shopping screen: live camera, barcode-first capture, pinned total. */
export function Shopping({ scanner }: { scanner?: BarcodeScanner }) {
  const { go, dispatch, storeId } = useShop();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<BarcodeScanner | null>(scanner ?? null);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captureNote, setCaptureNote] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean>(() => isOnline());
  const [reading, setReading] = useState(false);
  const [failures, setFailures] = useState(0);

  useEffect(() => subscribeOnline(() => setOnline(isOnline())), []);

  function getScanner(): BarcodeScanner {
    if (!scannerRef.current) scannerRef.current = new DetectorScanner();
    return scannerRef.current;
  }

  function addLine(item: ResolvedItem | TagItem, barcode: string) {
    dispatch({
      type: 'add',
      line: {
        barcode,
        name: item.name,
        priceMinor: item.priceMinor,
        source: item.source,
        observedAt: item.observedAt,
        confidence: item.confidence,
      },
    });
  }

  async function capture() {
    setCaptureNote(null);
    if (!storeId) {
      setCaptureNote('Pick a store first — prices are per store.');
      return;
    }
    if (!isOnline()) {
      setCaptureNote('You are offline — reconnect to read prices. Cached prices still work.');
      return;
    }
    const video = videoRef.current;
    if (!video) {
      setCaptureNote('Camera is not ready yet.');
      return;
    }
    const imageBase64 = await captureFrame(video);
    if (!imageBase64) {
      setCaptureNote('Could not grab a frame — retake and try again.');
      return;
    }
    setReading(true);
    try {
      const outcome = await captureFlow(imageBase64, {
        decodeBarcode: () => getScanner().detect(video),
        resolvePrice: async (barcode) => {
          const res = await fetch(
            `${API_BASE}/prices/resolve?storeId=${encodeURIComponent(storeId)}&barcode=${encodeURIComponent(barcode)}`,
          );
          if (res.status === 404) return null;
          if (!res.ok) throw new Error(`resolve failed (${res.status})`);
          return (await res.json()) as ResolvedItem;
        },
        readTag: async (image, barcode) => {
          const res = await fetch(`${API_BASE}/prices/read-tag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(barcode ? { imageBase64: image, storeId, barcode } : { imageBase64: image, storeId }),
          });
          if (res.status === 429) throw new Error('limit');
          if (!res.ok) throw new Error(`read-tag failed (${res.status})`);
          return (await res.json()) as TagItem & { stored: boolean };
        },
      });
      if (outcome.kind === 'resolved') {
        addLine(outcome.item, outcome.item.barcode);
        setCaptureNote('Price added to your basket.');
        setFailures(0);
      } else if (outcome.kind === 'tag') {
        addLine(outcome.item, outcome.item.barcode !== '' ? outcome.item.barcode : `tag-${Date.now()}`);
        setCaptureNote('Price added locally — scan the barcode to share it.');
        setFailures(0);
      } else {
        setFailures((f) => f + 1);
        setCaptureNote('Could not read that tag — retake the photo and try again.');
      }
    } catch {
      setFailures((f) => f + 1);
      setCaptureNote('Network failed — the photo stayed on your phone. Try again.');
    } finally {
      setReading(false);
    }
  }

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
          const video = videoRef.current;
          video.srcObject = stream;
          // MDN: muted/playsinline must be properties, not just attributes —
          // React's muted attribute alone does not flip the property on iOS.
          video.muted = true;
          video.playsInline = true;
          await new Promise<void>((resolve) => {
            const done = () => {
              video.removeEventListener('playing', done);
              resolve();
            };
            video.addEventListener('playing', done);
            void video.play().catch(() => resolve());
            // play() resolving is not frames. Cap the wait.
            window.setTimeout(() => resolve(), 3000);
          });
          if (cancelled) return;
        }
        setCamera('live');
        // Watchdog: play() can fail silently (autoplay policy), leaving a
        // black element. No frames after 3s means honestly unavailable.
        window.setTimeout(() => {
          if (!cancelled && (videoRef.current?.videoWidth ?? 0) === 0) {
            setCameraError('NoFrames');
            setCamera('unavailable');
          }
        }, 3000);
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : 'UnknownError';
        setCameraError(name);
        setCamera('unavailable');
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
          <div role="status" className="camera-fallback">
            <p>Camera unavailable here. Price capture needs a phone camera — everything else works.</p>
            {cameraError === 'NotAllowedError' && (
              <p>Permission was denied — allow camera access in the browser settings, then reload.</p>
            )}
            {(cameraError === 'NotFoundError' || cameraError === 'OverconstrainedError') && (
              <p>No suitable camera was found on this device.</p>
            )}
            {cameraError === 'NoFrames' && <p>The camera opened but sent no picture — try another browser.</p>}
            {cameraError !== null && <p className="camera-code">Code: {cameraError}</p>}
          </div>
        )}
        {/* Camera ref must mount in every state so the effect can attach the stream. */}
        {camera !== 'live' && <video ref={videoRef} playsInline muted hidden aria-hidden="true" />}
        <Mascot size={48} />
      </div>
      <div className="capture-row">
        <button type="button" className="primary capture" onClick={() => void capture()} disabled={reading}>
          {reading ? 'Reading…' : 'Capture price'}
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
      {failures >= OVERLAY_AFTER_FAILURES && (
        <CannotReadOverlay
          onRetry={() => {
            setFailures(0);
            setCaptureNote(null);
          }}
          onClose={() => go('basket')}
        />
      )}
    </main>
  );
}
