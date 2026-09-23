import {
  collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from '../firebase.js';

const bookingId = (classId, uid) => `${classId}_${uid}`;

/**
 * Seat count and booking doc change together in one transaction; firestore.rules
 * rejects either write on its own, so capacity can't be oversold.
 */
export function bookClass(classId, uid) {
  return runTransaction(db, async (tx) => {
    const classRef = doc(db, 'classes', classId);
    const bookingRef = doc(db, 'bookings', bookingId(classId, uid));
    const [cls, existing] = await Promise.all([tx.get(classRef), tx.get(bookingRef)]);
    if (!cls.exists()) throw new Error('Class no longer exists.');
    if (existing.exists()) throw new Error('You already booked this class.');
    const { bookedCount, capacity, startAt } = cls.data();
    if (bookedCount >= capacity) throw new Error('Class is full.');
    tx.update(classRef, { bookedCount: bookedCount + 1 });
    tx.set(bookingRef, { classId, uid, classStartAt: startAt, createdAt: serverTimestamp() });
  });
}

export function cancelBooking(classId, uid) {
  return runTransaction(db, async (tx) => {
    const classRef = doc(db, 'classes', classId);
    const bookingRef = doc(db, 'bookings', bookingId(classId, uid));
    const [cls, existing] = await Promise.all([tx.get(classRef), tx.get(bookingRef)]);
    if (!existing.exists()) return;
    if (cls.exists()) tx.update(classRef, { bookedCount: Math.max(0, cls.data().bookedCount - 1) });
    tx.delete(bookingRef);
  });
}

// Sorted client-side so the query needs no composite index (a member has few bookings).
export function watchMyBookings(uid, cb) {
  const q = query(collection(db, 'bookings'), where('uid', '==', uid));
  return onSnapshot(q, (snap) => cb(snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.classStartAt?.toMillis?.() ?? 0) - (b.classStartAt?.toMillis?.() ?? 0))));
}
