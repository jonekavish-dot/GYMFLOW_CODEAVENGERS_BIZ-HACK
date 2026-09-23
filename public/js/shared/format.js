const toDate = (ts) => (ts?.toDate ? ts.toDate() : new Date(ts));

export function fmtDate(ts) {
  return toDate(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ts) {
  return toDate(ts).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtLongNow() {
  return new Date().toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Indian-format rupees, e.g. 12500 → "₹12,500". */
export const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Local YYYY-MM-DD — never UTC, so "today" matches the gym's clock. */
export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const asDate = toDate;

/** Calendar-month arithmetic, matching the old portal's renewal maths. */
export function addMonths(from, months) {
  const d = toDate(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months));
  if (d.getDate() < day) d.setDate(0); // clamp Jan 31 + 1mo → Feb 28/29
  return d;
}

/** 'YYYY-MM' bucket key used by the revenue charts. */
export const monthKey = (ts) => todayStr(toDate(ts)).slice(0, 7);

export const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};
