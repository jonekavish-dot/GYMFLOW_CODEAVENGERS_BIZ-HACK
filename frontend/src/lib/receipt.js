// Printable payment receipt: opens a print window instead of embedding a PDF library.
import { fmtDate, fmtINR } from './format';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Returns false if the browser blocked the pop-up. */
export function printReceipt({ payment, gym = {} }) {
  const win = window.open('', '_blank', 'width=420,height=640');
  if (!win) return false;

  const no = `R-${String(payment.id).padStart(6, '0')}`;
  const months = payment.months || 1;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(no)}</title>
    <style>
      *{box-sizing:border-box} body{font:13px/1.6 system-ui,sans-serif;color:#111;margin:0;padding:24px}
      h1{font-size:18px;margin:0} .sub{color:#666;font-size:11px}
      .head{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;margin:12px 0} td{padding:6px 0;border-bottom:1px dashed #ccc}
      td:last-child{text-align:right;font-weight:600} .total{border-top:2px solid #111;font-size:15px;font-weight:700}
      .foot{text-align:center;color:#666;font-size:11px;margin-top:18px} @media print{body{padding:0}}
    </style></head><body>
    <div class="head"><h1>${esc(gym.name || 'GymFlow')}</h1>
      <div class="sub">${esc(gym.address || 'Membership & Class Booking')}${gym.phone ? ` · ${esc(gym.phone)}` : ''}</div></div>
    <div class="sub">Receipt <strong>${esc(no)}</strong> · ${esc(fmtDate(payment.at))}</div>
    <table>
      <tr><td>Member</td><td>${esc(payment.member_name)}</td></tr>
      <tr><td>Member ID</td><td>${esc(payment.custom_id || '–')}</td></tr>
      <tr><td>Plan</td><td>${esc(payment.plan_name)}</td></tr>
      <tr><td>Duration</td><td>${months} month${months > 1 ? 's' : ''}</td></tr>
      <tr><td>Type</td><td>${payment.kind === 'renewal' ? 'Renewal' : 'New joining'}</td></tr>
      <tr><td>Method</td><td>${esc(payment.method || 'Cash')}</td></tr>
      ${payment.expiry_after ? `<tr><td>Valid until</td><td>${esc(fmtDate(payment.expiry_after))}</td></tr>` : ''}
      <tr class="total"><td>Total paid</td><td>${esc(fmtINR(payment.amount))}</td></tr>
    </table>
    <div class="foot">Thank you, keep training!<br>${esc(gym.name || 'GymFlow')}</div>
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
