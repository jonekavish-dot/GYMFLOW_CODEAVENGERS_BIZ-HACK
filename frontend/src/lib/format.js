const DAY = 86_400_000;
const toDate = (v) => (v instanceof Date ? v : new Date(v));

export const fmtDate = (v) => toDate(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (v) => toDate(v).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtLongNow = () => new Date().toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Local YYYY-MM-DD, never UTC, so "today" matches the gym's wall clock. */
export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 'datetime-local' input value to the ISO string the API accepts (read in the browser's zone). */
export const localInputToIso = (v) => new Date(v).toISOString();

export const monthKey = (v) => todayStr(toDate(v)).slice(0, 7);
export const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

/** Whole days left, rounded up (0 or negative once expired). */
export const daysLeft = (expiry) => Math.ceil((toDate(expiry) - Date.now()) / DAY);

/** Decided on milliseconds, not rounded days, so it always agrees with the server's `expiry > now`. */
export function membershipStatus(expiry) {
  const ms = toDate(expiry) - Date.now();
  if (ms <= 0) {
    const ago = Math.max(1, Math.ceil(-ms / DAY));
    return { key: 'expired', label: `Expired ${ago}d ago`, days: -ago };
  }
  const days = Math.ceil(ms / DAY);
  if (days <= 7) return { key: 'expiring', label: `Expires in ${days}d`, days };
  return { key: 'active', label: `Active · ${days}d left`, days };
}

/** Consecutive present days ending today (or yesterday), from attendance rows. */
export function currentStreak(rows) {
  const present = new Set(rows.filter((r) => r.status === 'present').map((r) => r.date));
  let streak = 0;
  const cursor = new Date();
  if (!present.has(todayStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (present.has(todayStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function exerciseTally(rows) {
  const tally = new Map();
  rows.filter((r) => r.status === 'present').forEach((r) => (r.exercises || []).forEach((x) => tally.set(x, (tally.get(x) || 0) + 1)));
  return [...tally.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
