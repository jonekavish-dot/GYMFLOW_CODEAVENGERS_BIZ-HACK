// Front-desk check-in. An admin broadcasts one active code (shown as both a QR and
// six digits) with an admin-chosen expiry; a member proves they're physically at the
// gym by scanning or typing that code back. Both paths write the same codeUsed field,
// which firestore.rules checks against config/checkinSession before allowing the write.
import {
  addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where,
} from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';

const checkinsCol = collection(db, 'checkins');
const sessionRef = doc(db, 'config', 'checkinSession');

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Admin-only. Starts (or replaces) the one active code; old codes stop working immediately. */
export function generateCheckinSession({ validityMinutes, uid }) {
  const code = genCode();
  const expiresAt = Timestamp.fromMillis(Date.now() + validityMinutes * 60000);
  return setDoc(sessionRef, { code, expiresAt, validityMinutes, createdBy: uid, createdAt: serverTimestamp() })
    .then(() => code);
}

/** Admin-only. Expires the current code immediately, e.g. gym is closing early. */
export function revokeCheckinSession() {
  return setDoc(sessionRef, { expiresAt: Timestamp.fromMillis(0) }, { merge: true });
}

export function watchCheckinSession(cb) {
  return onSnapshot(sessionRef, (snap) => cb(snap.exists() ? snap.data() : null));
}

/** QR payload is just the code as text — the QR is a scannable shortcut for the same digits a member could type. */
export const qrPayload = (code) => code;

/** Admin manual override: check someone in by hand, no code needed (already covered by isAdmin() in rules). */
export function adminCheckIn(uid, method = 'manual') {
  return addDoc(checkinsCol, { uid, method, codeUsed: null, at: serverTimestamp(), checkedOutAt: null });
}

/**
 * Member self-check-in. Fails with a rules permission-denied if the code is wrong,
 * expired, or the membership isn't active — the client can't fake any of those.
 */
export async function selfCheckIn({ uid, code, method = 'qr' }) {
  const session = await getDoc(sessionRef);
  if (!session.exists() || session.data().code !== code) throw new Error('Wrong code.');
  if (session.data().expiresAt.toMillis() <= Date.now()) throw new Error('This code has expired — ask the front desk for the current one.');
  return addDoc(checkinsCol, { uid, method, codeUsed: code, at: serverTimestamp(), checkedOutAt: null });
}

export function checkOut(checkinId) {
  return setDoc(doc(db, 'checkins', checkinId), { checkedOutAt: serverTimestamp() }, { merge: true });
}

/** The member's own open (not checked-out) check-in, if any — drives the check-out button. */
export function watchMyOpenCheckin(uid, cb) {
  const q = query(checkinsCol, where('uid', '==', uid), where('checkedOutAt', '==', null));
  return onSnapshot(q, (snap) => cb(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }));
}

/** Members currently inside, with a live count and the raw docs for a roster. */
export function watchOccupancy(cb) {
  return onSnapshot(query(checkinsCol, where('checkedOutAt', '==', null)), (snap) => cb(snap.size, snap.docs));
}
