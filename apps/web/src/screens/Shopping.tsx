import { useEffect, useRef, useState } from 'react';
import { useShop } from '../basket.js';
import { BudgetBar } from '../components/BudgetBar.js';
import { Mascot } from '../components/Mascot.js';
import { isOnline, subscribeOnline } from '../offline/sync.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';
const MAX_DIMENSION = 1024;

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

/** Shopping screen: live camera, pinned total, capture. Photo read lands in step 5. */
export function Shopping() {
  const { go, dispatch, storeId } = useShop();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [captureNote, setCaptureNote] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean>(() => isOnline());
  const [reading, setReading] = useState(false);

  useEffect(() => subscribeOnline(() => setOnline(isOnline())), []);

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
      const res = await fetch(`${API_BASE}/prices/read-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No barcode yet (decode lands in step 6): the read returns
        // unstored and joins the local basket only.
        body: JSON.stringify({ imageBase64, storeId }),
      });
      if (res.status === 429) {
        setCaptureNote('Daily read limit reached — your cached prices still work.');
        return;
      }
      if (!res.ok) {
        setCaptureNote('Could not read that tag — retake the photo and try again.');
        return;
      }
      const read = (await res.json()) as {
        barcode: string;
        name?: string;
        priceMinor: number;
        source: 'tag';
        observedAt: string;
        confidence: number;
        stored: boolean;
      };
      dispatch({
        type: 'add',
        line: {
          barcode: read.barcode !== '' ? read.barcode : `tag-${Date.now()}`,
          name: read.name ?? 'Shelf item',
          priceMinor: read.priceMinor,
          source: 'tag',
          observedAt: read.observedAt,
          confidence: read.confidence,
        },
      });
      setCaptureNote(read.stored ? 'Price added to your basket.' : 'Price added locally — scan the barcode to share it.');
    } catch {
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
    </main>
  );
}
