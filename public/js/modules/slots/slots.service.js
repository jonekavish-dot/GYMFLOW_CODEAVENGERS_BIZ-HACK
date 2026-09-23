// Gym Slot Service — manages workout time-slots, max customer overload,
// attendee rosters, and atomic slot reservations.
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, Timestamp, updateDoc, where,
} from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';
import { fmtDateTime } from '../../shared/format.js';

const slotsCol = collection(db, 'slots');
const bookingsCol = collection(db, 'slot_bookings');

export const slotBookingId = (slotId, uid) => `${slotId}_${uid}`;

/**
 * Checks if a trainer already has a slot that overlaps with the requested time window.
 * Two intervals [S1, E1) and [S2, E2) overlap if S1 < E2 and E1 > S2.
 * @returns {Promise<{conflict: boolean, existingSlot?: object}>}
 */
export async function findTrainerTimeConflict(trainer, startAt, durationMin, excludeSlotId = null) {
  const cleanTrainer = (trainer || '').trim();
  if (!cleanTrainer) return { conflict: false };

  const start = new Date(startAt);
  const startMs = start.getTime();
  const endMs = startMs + Number(durationMin) * 60000;

  const snap = await getDocs(query(slotsCol, where('trainer', '==', cleanTrainer)));
  for (const docSnap of snap.docs) {
    if (excludeSlotId && docSnap.id === excludeSlotId) continue;
    const existing = { id: docSnap.id, ...docSnap.data() };
    const eStartMs = existing.startAt?.toMillis ? existing.startAt.toMillis() : new Date(existing.startAt).getTime();
    const eEndMs = existing.endAt?.toMillis
      ? existing.endAt.toMillis()
      : eStartMs + (existing.durationMin || 60) * 60000;

    // Overlap condition: startMs < eEndMs && endMs > eStartMs
    if (startMs < eEndMs && endMs > eStartMs) {
      return { conflict: true, existingSlot: existing };
    }
  }
  return { conflict: false };
}

/**
 * Admin creates a workout slot with a specific time window and max customer overload (capacity).
 * Enforces trainer time security: a trainer cannot be booked for overlapping slots until the full slot completes.
 */
export async function createSlot({ title, trainer = '', startAt, endAt, durationMin, capacity, notes = '', status = 'open' }) {
  const start = new Date(startAt);
  const duration = durationMin ? Number(durationMin) : Math.round(((endAt ? new Date(endAt) : start).getTime() - start.getTime()) / 60000) || 60;
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + duration * 60000);
  const cleanTrainer = trainer.trim();

  // ── Time & Trainer Security Check ──
  // A trainer cannot be double-booked across overlapping times.
  // Until the completion of their current slot, no new slot can be booked for that trainer.
  if (cleanTrainer) {
    const { conflict, existingSlot } = await findTrainerTimeConflict(cleanTrainer, start, duration);
    if (conflict) {
      const eStart = fmtDateTime(existingSlot.startAt);
      const eEndMs = existingSlot.endAt?.toMillis
        ? existingSlot.endAt.toMillis()
        : (existingSlot.startAt?.toMillis ? existingSlot.startAt.toMillis() : new Date(existingSlot.startAt).getTime()) + (existingSlot.durationMin || 60) * 60000;
      const eEnd = fmtDateTime(new Date(eEndMs));
      throw new Error(
        `Time Security Conflict: Trainer "${cleanTrainer}" is already booked for "${existingSlot.title}" (${eStart} – ${eEnd}). A new slot can only be booked after that slot has completed.`
      );
    }
  }

  return addDoc(slotsCol, {
    title,
    trainer: cleanTrainer,
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

    // Time Security: Ensure slot has not already ended/completed
    const nowMs = Date.now();
    const slotEndMs = slotData.endAt?.toMillis
      ? slotData.endAt.toMillis()
      : (slotData.startAt?.toMillis?.() ?? 0) + (slotData.durationMin || 60) * 60000;
    if (slotEndMs <= nowMs) {
      throw new Error('This workout slot has already completed.');
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

/**
 * Admin-only: removes one attendee from a slot's roster and frees their seat.
 * Members can't cancel their own booking (deliberate — see slots.view.js), so this
 * is the only way to undo a booking, e.g. a no-show or a booking made by mistake.
 * isAdmin() bypasses the slots/slot_bookings rules entirely, so this is a plain
 * transaction rather than needing the member-side existsAfter() pairing dance.
 */
export function adminRemoveSlotBooking(slotId, uid) {
  return runTransaction(db, async (tx) => {
    const slotRef = doc(db, 'slots', slotId);
    const bookingRef = doc(db, 'slot_bookings', slotBookingId(slotId, uid));

    const [slotDoc, existingBooking] = await Promise.all([tx.get(slotRef), tx.get(bookingRef)]);
    if (!existingBooking.exists()) throw new Error('That member is not booked into this slot.');
    if (slotDoc.exists()) {
      tx.update(slotRef, { bookedCount: Math.max(0, slotDoc.data().bookedCount - 1) });
    }
    tx.delete(bookingRef);
  });
}
