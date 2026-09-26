// Camera QR scanning. Uses the native BarcodeDetector where it exists (Android/ChromeOS Chrome)
// and jsQR everywhere else. Desktop Chrome on Windows has no BarcodeDetector, so the jsQR
// path is the real one, not an edge case.

/**
 * Starts the camera into `video` and calls onDecode(text) for each successful read.
 * Returns a stop() function that releases the camera.
 */
export async function startScanner(video, onDecode, onError) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (e) {
    onError?.(new Error(e.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Could not access the camera.'));
    return () => {};
  }
  video.srcObject = stream;
  video.setAttribute('playsinline', ''); // iOS Safari otherwise forces fullscreen
  await video.play().catch(() => {});

  const native = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
  const jsQR = native ? null : (await import('jsqr')).default;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let stopped = false;
  let raf;

  async function tick() {
    if (stopped) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        if (native) {
          const codes = await native.detect(canvas);
          if (codes.length) { onDecode(codes[0].rawValue); return; }
        } else {
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hit = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
          if (hit?.data) { onDecode(hit.data); return; }
        }
      } catch { /* one bad frame isn't worth surfacing; try the next */ }
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
}
