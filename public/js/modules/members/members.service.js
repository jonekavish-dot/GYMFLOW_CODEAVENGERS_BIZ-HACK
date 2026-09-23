import { createUserWithEmailAndPassword, signOut } from '../../core/sdk/auth.js';
import {
  collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc, writeBatch, serverTimestamp, Timestamp,
} from '../../core/sdk/firestore.js';
import { db, withSecondaryAuth } from '../../core/firebase.js';
import { ROLES } from '../../core/auth.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Admin-only. Creates the member's login (via a secondary Auth instance so the
 * admin stays signed in), then their role doc and membership doc in one batch.
 */
export async function registerMember({ name, email, phone, password, plan, startDate = new Date(), goals = '' }) {
  const uid = await withSecondaryAuth(async (secondaryAuth) => {
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return user.uid;
  });

  const start = new Date(startDate);
  const expiry = new Date(start.getTime() + plan.durationDays * DAY_MS);

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), { role: ROLES.MEMBER, email, name, createdAt: serverTimestamp() });
  batch.set(doc(db, 'members', uid), {
    name, email, phone, goals,
    planId: plan.id, planName: plan.name,
    startDate: Timestamp.fromDate(start),
    expiryDate: Timestamp.fromDate(expiry),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return uid;
}

export async function getMember(uid) {
  const snap = await getDoc(doc(db, 'members', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export function watchMember(uid, cb) {
  return onSnapshot(doc(db, 'members', uid), (snap) => cb(snap.exists() ? { uid, ...snap.data() } : null));
}

export function watchMembers(cb) {
  return onSnapshot(query(collection(db, 'members'), orderBy('expiryDate')), (snap) =>
    cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))));
}

export function updateGoals(uid, goals) {
  return updateDoc(doc(db, 'members', uid), { goals });
}

/** Whole days left on a membership; negative once expired. */
export function daysLeft(expiryDate) {
  const ms = (expiryDate?.toDate ? expiryDate.toDate() : new Date(expiryDate)) - Date.now();
  return Math.ceil(ms / DAY_MS);
}

export function membershipStatus(expiryDate) {
  const d = daysLeft(expiryDate);
  if (d < 0) return { key: 'expired', label: `Expired ${-d}d ago`, days: d };
  if (d <= 7) return { key: 'expiring', label: `Expires in ${d}d`, days: d };
  return { key: 'active', label: `Active · ${d}d left`, days: d };
}
