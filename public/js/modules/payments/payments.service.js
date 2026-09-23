// Revenue ledger. The old portal derived revenue by re-reading member join/renewal
// fields; here every join and renewal appends an immutable payment row, so the
// charts and totals never have to guess.
import { collection, onSnapshot, query, where } from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';
import { monthKey, monthLabel, todayStr } from '../../shared/format.js';

export const METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

const sortDesc = (rows) => rows.sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0));

export function watchPayments(cb) {
  return onSnapshot(collection(db, 'payments'), (snap) =>
    cb(sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })))));
}

/** Index-free: filter by uid only, order client-side. */
export function watchMemberPayments(uid, cb) {
  return onSnapshot(query(collection(db, 'payments'), where('uid', '==', uid)), (snap) =>
    cb(sortDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })))));
}

export function summarise(payments) {
  const today = todayStr();
  const thisMonth = monthKey(new Date());
  const sum = (rows) => rows.reduce((t, p) => t + (Number(p.amount) || 0), 0);
  const on = (p) => (p.at ? todayStr(p.at.toDate()) : '');

  return {
    total: sum(payments),
    today: sum(payments.filter((p) => on(p) === today)),
    month: sum(payments.filter((p) => p.at && monthKey(p.at) === thisMonth)),
    renewals: sum(payments.filter((p) => p.kind === 'renewal')),
    joins: sum(payments.filter((p) => p.kind === 'join')),
    count: payments.length,
    byMethod: METHODS.map((m) => ({ method: m, amount: sum(payments.filter((p) => p.method === m)) })),
  };
}

/** Last `months` calendar months of revenue, split by joins vs renewals. */
export function monthlySeries(payments, months = 6) {
  const keys = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  const bucket = (kind, key) => payments
    .filter((p) => p.at && monthKey(p.at) === key && (!kind || p.kind === kind))
    .reduce((t, p) => t + (Number(p.amount) || 0), 0);

  return {
    labels: keys.map(monthLabel),
    total: keys.map((k) => bucket(null, k)),
    joins: keys.map((k) => bucket('join', k)),
    renewals: keys.map((k) => bucket('renewal', k)),
  };
}
