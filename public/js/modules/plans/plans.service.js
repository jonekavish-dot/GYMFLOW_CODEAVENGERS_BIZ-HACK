import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';

const plansCol = collection(db, 'plans');

export function createPlan({ name, durationDays, price, description = '' }) {
  return addDoc(plansCol, {
    name, description,
    durationDays: Number(durationDays),
    price: Number(price),
    active: true,
    createdAt: serverTimestamp(),
  });
}

export function setPlanActive(id, active) {
  return updateDoc(doc(db, 'plans', id), { active });
}

export function watchPlans(cb) {
  return onSnapshot(query(plansCol, orderBy('durationDays')), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Per-month rate, so renewals can be priced in months like the old portal did. */
export const monthlyRate = (plan) => Math.round((plan.price || 0) / Math.max(1, (plan.durationDays || 30) / 30));

export const RENEW_MONTHS = [
  { months: 1, label: 'Monthly' },
  { months: 3, label: 'Quarterly' },
  { months: 6, label: 'Half-Yearly' },
  { months: 12, label: 'Yearly' },
];
