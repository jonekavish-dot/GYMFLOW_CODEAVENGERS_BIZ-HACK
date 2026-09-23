import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from '../firebase.js';

const classesCol = collection(db, 'classes');

export function createClass({ title, trainer, startAt, durationMin, capacity, tags = [] }) {
  return addDoc(classesCol, {
    title, trainer, tags,
    startAt: Timestamp.fromDate(new Date(startAt)),
    durationMin: Number(durationMin),
    capacity: Number(capacity),
    bookedCount: 0,
    createdAt: serverTimestamp(),
  });
}

export function deleteClass(id) {
  return deleteDoc(doc(db, 'classes', id));
}

/** Live list of classes that haven't started yet — drives booking + occupancy views. */
export function watchUpcomingClasses(cb) {
  const q = query(classesCol, where('startAt', '>=', Timestamp.now()), orderBy('startAt'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
