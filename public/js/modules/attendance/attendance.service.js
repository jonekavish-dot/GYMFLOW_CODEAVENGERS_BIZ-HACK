// Daily attendance. The old portal kept one document per date holding maps of every
// member's status, which meant a member could not read their own row without reading
// everyone's. Here each person-day is its own doc (`${date}_${uid}`), which also
// removes the read-modify-write race when two staff mark attendance at once.
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where,
} from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';
import { todayStr } from '../../shared/format.js';

export const STATUS = { PRESENT: 'present', ABSENT: 'absent', REST: 'rest' };

const attCol = collection(db, 'attendance');
const rowId = (date, uid) => `${date}_${uid}`;

/**
 * Marks one person for one day. Ticked exercises ride along on the same doc, so the
 * "present needs at least one exercise" rule from the old portal is enforced here.
 */
export function mark({ date, uid, name, kind = 'member', status, exercises = [], notes = '' }) {
  if (status === STATUS.PRESENT && kind === 'member' && exercises.length === 0) {
    throw new Error('Tick at least one exercise before marking present.');
  }
  return setDoc(doc(db, 'attendance', rowId(date, uid)), {
    date, uid, name, kind, status, exercises, notes, at: serverTimestamp(),
  });
}

export function setExercises({ date, uid, name, kind = 'member', exercises, status, notes = '' }) {
  return setDoc(doc(db, 'attendance', rowId(date, uid)), {
    date, uid, name, kind, exercises, notes,
    status: exercises.length === 0 && status === STATUS.PRESENT ? STATUS.ABSENT : status,
    at: serverTimestamp(),
  }, { merge: true });
}

export function clearMark(date, uid) {
  return deleteDoc(doc(db, 'attendance', rowId(date, uid)));
}

/** All rows for one day, keyed by uid. */
export function watchDay(date, cb) {
  return onSnapshot(query(attCol, where('date', '==', date)), (snap) => {
    const byUid = {};
    snap.docs.forEach((d) => { byUid[d.data().uid] = { id: d.id, ...d.data() }; });
    cb(byUid);
  });
}

/** Index-free history for one person, newest first. */
export function watchPersonHistory(uid, cb) {
  return onSnapshot(query(attCol, where('uid', '==', uid)), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.date.localeCompare(a.date))));
}

/** Rolling window ending today, used for the streak and analytics panels. */
export function watchRecent(days, cb) {
  const from = todayStr(new Date(Date.now() - days * 86400000));
  return onSnapshot(query(attCol, where('date', '>=', from)), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Longest run of consecutive days ending today (or yesterday) with a present mark. */
export function currentStreak(rows) {
  const present = new Set(rows.filter((r) => r.status === STATUS.PRESENT).map((r) => r.date));
  let streak = 0;
  const cursor = new Date();
  if (!present.has(todayStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (present.has(todayStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** How often each exercise was logged, most-done first. */
export function exerciseTally(rows) {
  const tally = new Map();
  rows.filter((r) => r.status === STATUS.PRESENT).forEach((r) => {
    (r.exercises || []).forEach((ex) => tally.set(ex, (tally.get(ex) || 0) + 1));
  });
  return [...tally.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
