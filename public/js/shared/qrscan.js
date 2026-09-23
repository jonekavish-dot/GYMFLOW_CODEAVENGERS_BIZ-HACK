// Camera QR scanning for the member check-in flow. Uses the native BarcodeDetector
// where it exists (Android/ChromeOS Chrome) and falls back to jsQR everywhere else —
// notably desktop Chrome on Windows, which has no BarcodeDetector at all, so the
// fallback is the real path, not a rare edge case.
const JSQR_CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
let jsQRReady;

function loadJsQR() {
  if (!jsQRReady) {
    jsQRReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSQR_CDN;
      s.onload = () => resolve(window.jsQR);
      s.onerror = () => reject(new Error('Could not load the QR scanner library — check your connection.'));
      document.head.append(s);
    });
  }
  return jsQRReady;
}

/**
 * Starts the camera into `videoEl` and calls `onDecode(text)` once per successful
 * scan (not repeatedly for the same frame's code — caller decides what "once" means
 * by stopping the scanner). Returns a stop() function that releases the camera.
 */
export async function startScanner(videoEl, onDecode, onError) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (e) {
    onError?.(new Error(e.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Could not access the camera.'));
    return () => {};
  }
  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline', ''); // iOS Safari: without this it forces fullscreen
  await videoEl.play();

  const hasNativeDetector = 'BarcodeDetector' in window;
  const detector = hasNativeDetector ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
  const jsQR = hasNativeDetector ? null : await loadJsQR().catch((e) => { onError?.(e); return null; });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let stopped = false;
  let raf;

  async function tick() {
    if (stopped) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      try {
        if (detector) {
          const codes = await detector.detect(canvas);
          if (codes.length) { onDecode(codes[0].rawValue); return; }
        } else if (jsQR) {
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
          if (result?.data) { onDecode(result.data); return; }
        }
      } catch { /* a single bad frame is not worth surfacing — just try the next one */ }
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    videoEl.srcObject = null;
  };
}
