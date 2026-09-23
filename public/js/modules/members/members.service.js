import { createUserWithEmailAndPassword, signOut } from '../../core/sdk/auth.js';
import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc,
  writeBatch, serverTimestamp, Timestamp,
} from '../../core/sdk/firestore.js';
import { db, withSecondaryAuth } from '../../core/firebase.js';
import { ROLES } from '../../core/auth.js';
import { addMonths, todayStr } from '../../shared/format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Human-facing membership id, e.g. ASF001 — carried over from the old portal. */
export function nextCustomId(members, prefix = 'ASF') {
  const max = members.reduce((hi, m) => {
    const n = Number(String(m.customId || '').replace(/\D/g, ''));
    return Number.isFinite(n) ? Math.max(hi, n) : hi;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/**
 * Admin-only. Creates the member's login (via a secondary Auth instance so the
 * admin stays signed in), then their role doc, membership doc and the opening
 * payment in one batch.
 */
export async function registerMember({
  name, email, phone, password, plan, startDate = new Date(), goals = '',
  customId = '', exerciseCategory = 'A', paid = 0, method = 'Cash', notes = '', months = 0,
}) {
  const uid = await withSecondaryAuth(async (secondaryAuth) => {
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return user.uid;
  });

  const start = new Date(startDate);
  const expiry = months > 0 ? addMonths(start, months) : new Date(start.getTime() + plan.durationDays * DAY_MS);
  const fee = Number(paid) || 0;

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), { role: ROLES.MEMBER, email, name, createdAt: serverTimestamp() });
  batch.set(doc(db, 'members', uid), {
    name, email, phone, goals, customId, exerciseCategory, notes, method,
    planId: plan.id, planName: plan.name,
    startDate: Timestamp.fromDate(start),
    expiryDate: Timestamp.fromDate(expiry),
    paid: fee,
    renewalCount: 0,
    createdAt: serverTimestamp(),
  });
  if (fee > 0) {
    batch.set(doc(collection(db, 'payments')), {
      uid, memberName: name, customId, amount: fee, method, kind: 'join',
      months: months || Math.round(plan.durationDays / 30),
      planId: plan.id, planName: plan.name,
      at: Timestamp.fromDate(start),
      expiryAfter: Timestamp.fromDate(expiry),
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return uid;
}

/**
 * Extends a membership and records the payment. Expired memberships restart from
 * today; active ones stack on top of the remaining time (old-portal behaviour).
 */
export async function renewMembership({ member, plan, months, fee, method = 'Cash' }) {
  const from = daysLeft(member.expiryDate) < 0 ? new Date() : member.expiryDate;
  const expiry = addMonths(from, months);
  const amount = Number(fee) || 0;

  const batch = writeBatch(db);
  batch.update(doc(db, 'members', member.uid), {
    planId: plan.id,
    planName: plan.name,
    expiryDate: Timestamp.fromDate(expiry),
    paid: (member.paid || 0) + amount,
    method,
    renewalCount: (member.renewalCount || 0) + 1,
    lastRenewal: todayStr(),
    lastRenewalFee: amount,
  });
  batch.set(doc(collection(db, 'payments')), {
    uid: member.uid, memberName: member.name, customId: member.customId || '',
    amount, method, months: Number(months), kind: 'renewal',
    planId: plan.id, planName: plan.name,
    at: serverTimestamp(),
    expiryAfter: Timestamp.fromDate(expiry),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return expiry;
}

export function updateMember(uid, patch) {
  return updateDoc(doc(db, 'members', uid), patch);
}

/**
 * Removes the membership and role docs. The Auth login itself needs the Admin SDK,
 * so it survives — without a role doc the sign-in is rejected by requireRole().
 */
export async function deleteMember(uid) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'members', uid));
  batch.delete(doc(db, 'users', uid));
  await batch.commit();
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

export async function listMembers() {
  const snap = await getDocs(query(collection(db, 'members'), orderBy('name')));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
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
