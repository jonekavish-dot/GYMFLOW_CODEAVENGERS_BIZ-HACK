import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';

const trainersCol = collection(db, 'trainers');

export function createTrainer({ name, role, exp, phone, title = '', skills = [], isOwner = false }) {
  return addDoc(trainersCol, {
    name, role, phone, title, skills, isOwner,
    exp: Number(exp) || 0,
    active: true,
    createdAt: serverTimestamp(),
  });
}

export function updateTrainer(id, patch) {
  return updateDoc(doc(db, 'trainers', id), patch);
}

export function deleteTrainer(id) {
  return deleteDoc(doc(db, 'trainers', id));
}

export function watchTrainers(cb) {
  return onSnapshot(query(trainersCol, orderBy('name')), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
