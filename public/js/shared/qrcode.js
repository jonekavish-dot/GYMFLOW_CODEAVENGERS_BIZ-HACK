// QR encoding for the admin check-in desk, loaded on first use. qrcode-generator has
// no build step and no dependencies — it defines a global qrcode() factory that
// renders straight to an SVG string, so there's no canvas/image round-trip.
const CDN = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
let ready;

function load() {
  if (!ready) {
    ready = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CDN;
      s.onload = () => resolve(window.qrcode);
      s.onerror = () => reject(new Error('Could not load the QR code library — check your connection.'));
      document.head.append(s);
    });
  }
  return ready;
}

/** Renders `text` as an SVG QR code into `el` (replaces its contents). */
export async function renderQR(el, text) {
  const qrcode = await load();
  const qr = qrcode(0, 'M'); // type 0 = auto-size for the data length
  qr.addData(String(text));
  qr.make();
  el.innerHTML = qr.createSvgTag({ scalable: true });
}
