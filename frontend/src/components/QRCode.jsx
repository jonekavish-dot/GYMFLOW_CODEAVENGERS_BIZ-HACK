import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** Renders `value` as an SVG QR code (type 0 = auto-size for the data). */
export function QRCode({ value }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(String(value));
    qr.make();
    return qr.createSvgTag({ scalable: true });
  }, [value]);
  // The markup is generated locally from a numeric string; nothing user-controlled reaches it.
  return <div className="checkin-qr" dangerouslySetInnerHTML={{ __html: svg }} />;
}
