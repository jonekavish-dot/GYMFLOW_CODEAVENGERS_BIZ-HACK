// QR check-in + live occupancy. Wired into the portals in the next step.
import {
  addDoc, collection, onSnapshot, query, serverTimestamp, where,
} from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';

const checkinsCol = collection(db, 'checkins');

/** Payload encoded in a member's QR code; the admin scanner decodes it into checkIn(). */
export const qrPayload = (uid) => JSON.stringify({ t: 'ps76-checkin', uid });

export function checkIn(uid, method = 'qr') {
  return addDoc(checkinsCol, { uid, method, at: serverTimestamp(), checkedOutAt: null });
}

/** Members currently inside = check-ins with no check-out yet. */
export function watchOccupancy(cb) {
  return onSnapshot(query(checkinsCol, where('checkedOutAt', '==', null)), (snap) => cb(snap.size, snap.docs));
}
