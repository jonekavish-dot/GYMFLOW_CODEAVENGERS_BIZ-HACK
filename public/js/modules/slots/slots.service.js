// Gym Slot Service — manages workout time-slots, max customer overload,
// attendee rosters, and atomic slot reservations.
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, Timestamp, updateDoc, where,
} from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';

const slotsCol = collection(db, 'slots');
const bookingsCol = collection(db, 'slot_bookings');

export const slotBookingId = (slotId, uid) => `${slotId}_${uid}`;

/**
 * Admin creates a workout slot with a specific time window and max customer overload (capacity).
 */
export function createSlot({ title, startAt, endAt, durationMin, capacity, notes = '', status = 'open' }) {
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + Number(durationMin) * 60000);
  const duration = durationMin ? Number(durationMin) : Math.round((end.getTime() - start.getTime()) / 60000);

  return addDoc(slotsCol, {
    title,
    startAt: Timestamp.fromDate(start),
    endAt: Timestamp.fromDate(end),
    durationMin: duration,
    capacity: Math.max(1, Number(capacity)),
    bookedCount: 0,
    status, // 'open' | 'closed'
    notes,
    createdAt: serverTimestamp(),
  });
}

/**
 * Admin deletes a slot.
 */
export function deleteSlot(slotId) {
  return deleteDoc(doc(db, 'slots', slotId));
}

/**
 * Admin manually toggles slot open/close.
 */
export function updateSlotStatus(slotId, status) {
  return updateDoc(doc(db, 'slots', slotId), { status });
}

/**
 * Live stream of upcoming slots.
 */
export function watchUpcomingSlots(cb) {
  const q = query(slotsCol, where('startAt', '>=', Timestamp.now()), orderBy('startAt'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/**
 * Admin live stream of attendees for a specific slot.
 */
export function watchSlotBookings(slotId, cb) {
  const q = query(bookingsCol, where('slotId', '==', slotId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/**
 * Member's personal slot bookings (client-side sorted).
 */
export function watchMySlotBookings(uid, cb) {
  const q = query(bookingsCol, where('uid', '==', uid));
  return onSnapshot(q, (snap) => cb(snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.slotStartAt?.toMillis?.() ?? 0) - (b.slotStartAt?.toMillis?.() ?? 0))));
}

/**
 * Atomic slot booking: checks capacity, checks closed status, increments bookedCount,
 * and creates the booking record in a single transaction.
 */
export function bookSlot(slotId, { uid, name, customId = '' }) {
  return runTransaction(db, async (tx) => {
    const slotRef = doc(db, 'slots', slotId);
    const bookingRef = doc(db, 'slot_bookings', slotBookingId(slotId, uid));

    const [slotDoc, existingBooking] = await Promise.all([tx.get(slotRef), tx.get(bookingRef)]);

    if (!slotDoc.exists()) throw new Error('Slot no longer exists.');
    if (existingBooking.exists()) throw new Error('You have already booked this slot.');

    const slotData = slotDoc.data();
    if (slotData.status === 'closed') {
      throw new Error('This slot is closed for new bookings.');
    }
    if (slotData.bookedCount >= slotData.capacity) {
      throw new Error('This slot has reached maximum customer overload (full).');
    }

    tx.update(slotRef, { bookedCount: slotData.bookedCount + 1 });
    tx.set(bookingRef, {
      slotId,
      uid,
      memberName: name,
      customId,
      slotStartAt: slotData.startAt,
      createdAt: serverTimestamp(),
    });
  });
}

/**
 * Atomic slot cancellation: frees up the seat and deletes the booking record.
 */
export function cancelSlotBooking(slotId, uid) {
  return runTransaction(db, async (tx) => {
    const slotRef = doc(db, 'slots', slotId);
    const bookingRef = doc(db, 'slot_bookings', slotBookingId(slotId, uid));

    const [slotDoc, existingBooking] = await Promise.all([tx.get(slotRef), tx.get(bookingRef)]);

    if (!existingBooking.exists()) return;
    if (slotDoc.exists()) {
      tx.update(slotRef, { bookedCount: Math.max(0, slotDoc.data().bookedCount - 1) });
    }
    tx.delete(bookingRef);
  });
}
