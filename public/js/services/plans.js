import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from '../firebase.js';

const plansCol = collection(db, 'plans');

export function createPlan({ name, durationDays, price, description = '' }) {
  return addDoc(plansCol, {
    name, description,
    durationDays: Number(durationDays),
    price: Number(price),
    active: true,
    createdAt: serverTimestamp(),
  });
}

export function setPlanActive(id, active) {
  return updateDoc(doc(db, 'plans', id), { active });
}

export function watchPlans(cb) {
  return onSnapshot(query(plansCol, orderBy('durationDays')), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
