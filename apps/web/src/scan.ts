/** Test seam: single-frame barcode decode. Production uses the camera frame. */
export interface BarcodeScanner {
  detect(image: CanvasImageSource): Promise<string | null>;
}

interface NativeDetected {
  rawValue: string;
}

interface NativeDetector {
  detect(image: CanvasImageSource): Promise<NativeDetected[]>;
}

/**
 * Native BarcodeDetector first (Shape Detection API), zxing-wasm ponyfill
 * as fallback — dynamically imported so the WASM stays out of the main bundle
 * until the first scan attempt.
 */
export class DetectorScanner implements BarcodeScanner {
  async detect(image: CanvasImageSource): Promise<string | null> {
    const Native = (globalThis as unknown as Record<string, unknown>)['BarcodeDetector'];
    if (typeof Native === 'function') {
      const detector = new (Native as new () => NativeDetector)();
      const found = await detector.detect(image);
      return found[0]?.rawValue ?? null;
    }
    const { BarcodeDetector } = await import('barcode-detector/ponyfill');
    const detector = new BarcodeDetector();
    const found = await detector.detect(image);
    return found[0]?.rawValue ?? null;
  }
}
