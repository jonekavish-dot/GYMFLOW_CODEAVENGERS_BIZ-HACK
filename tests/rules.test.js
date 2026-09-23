// Security-rule tests for firestore.rules. Run: cd ps76/tests && npm install && npm test
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  deleteDoc, doc, getDoc, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch,
} from 'firebase/firestore';

const DAY = 86400000;
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ps76',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

async function seed(data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, value] of Object.entries(data)) await setDoc(doc(db, path), value);
  });
}

const member = (days) => ({ name: 'M', email: 'm@x.com', planName: 'Monthly', goals: '', expiryDate: Timestamp.fromMillis(Date.now() + days * DAY) });
const cls = (bookedCount, capacity = 2) => ({ title: 'HIIT', trainer: 'T', capacity, bookedCount, startAt: Timestamp.fromMillis(Date.now() + DAY) });

function bootstrapBatch(db, uid, role = 'admin') {
  const b = writeBatch(db);
  b.set(doc(db, 'users', uid), { role, email: 'a@x.com', name: 'A', createdAt: serverTimestamp() });
  b.set(doc(db, 'config', 'bootstrap'), { adminUid: uid, createdAt: serverTimestamp() });
  return b.commit();
}

function book(db, classId, uid) {
  return runTransaction(db, async (tx) => {
    const c = await tx.get(doc(db, 'classes', classId));
    tx.update(doc(db, 'classes', classId), { bookedCount: c.data().bookedCount + 1 });
    tx.set(doc(db, 'bookings', `${classId}_${uid}`), { classId, uid, classStartAt: c.data().startAt });
  });
}

describe('connection probe', () => {
  it('anyone can read config/bootstrap', () => assertSucceeds(getDoc(doc(anon(), 'config', 'bootstrap'))));
});

describe('first-admin bootstrap', () => {
  it('first user can become admin together with the bootstrap marker', () => assertSucceeds(bootstrapBatch(as('alice'), 'alice')));

  it('a second user cannot bootstrap once setup is done', async () => {
    await seed({ 'config/bootstrap': { adminUid: 'alice' }, 'users/alice': { role: 'admin' } });
    await assertFails(bootstrapBatch(as('mallory'), 'mallory'));
  });

  it('cannot self-assign admin without the bootstrap marker', () =>
    assertFails(setDoc(doc(as('mallory'), 'users/mallory'), { role: 'admin' })));

  it('cannot self-create a member role doc', () =>
    assertFails(setDoc(doc(as('mallory'), 'users/mallory'), { role: 'member' })));
});

describe('role split', () => {
  beforeEach(() => seed({
    'users/admin': { role: 'admin' },
    'users/m1': { role: 'member' },
    'members/m1': member(30),
    'members/m2': member(30),
  }));

  it('admin can create plans, members cannot', async () => {
    await assertSucceeds(setDoc(doc(as('admin'), 'plans/p1'), { name: 'Monthly', durationDays: 30, price: 999, active: true }));
    await assertFails(setDoc(doc(as('m1'), 'plans/p2'), { name: 'Free', durationDays: 999, price: 0, active: true }));
  });

  it('admin registers a member (role + membership docs)', async () => {
    const db = as('admin');
    const b = writeBatch(db);
    b.set(doc(db, 'users/new'), { role: 'member' });
    b.set(doc(db, 'members/new'), member(30));
    await assertSucceeds(b.commit());
  });

  it('member cannot escalate their own role', () => assertFails(updateDoc(doc(as('m1'), 'users/m1'), { role: 'admin' })));
  it('member reads own membership, not others', async () => {
    await assertSucceeds(getDoc(doc(as('m1'), 'members/m1')));
    await assertFails(getDoc(doc(as('m1'), 'members/m2')));
  });
  it('member can edit goals but not extend expiry', async () => {
    await assertSucceeds(updateDoc(doc(as('m1'), 'members/m1'), { goals: 'stamina' }));
    await assertFails(updateDoc(doc(as('m1'), 'members/m1'), { expiryDate: Timestamp.fromMillis(Date.now() + 999 * DAY) }));
  });
  it('member cannot schedule classes', () => assertFails(setDoc(doc(as('m1'), 'classes/c9'), cls(0))));
});

describe('class booking', () => {
  beforeEach(() => seed({
    'users/m1': { role: 'member' }, 'members/m1': member(30),
    'users/m2': { role: 'member' }, 'members/m2': member(30),
    'users/old': { role: 'member' }, 'members/old': member(-1),
    'classes/c1': cls(0, 1),
  }));

  it('active member can book a seat', () => assertSucceeds(book(as('m1'), 'c1', 'm1')));

  it('cannot overbook past capacity', async () => {
    await book(as('m1'), 'c1', 'm1');
    await assertFails(book(as('m2'), 'c1', 'm2'));
  });

  it('expired member cannot book', () => assertFails(book(as('old'), 'c1', 'old')));

  it('cannot bump bookedCount without a booking doc', () =>
    assertFails(updateDoc(doc(as('m1'), 'classes/c1'), { bookedCount: 1 })));

  it('cannot create a booking without taking a seat', () =>
    assertFails(setDoc(doc(as('m1'), 'bookings/c1_m1'), { classId: 'c1', uid: 'm1' })));

  it('cannot book on behalf of someone else', () => assertFails(book(as('m1'), 'c1', 'm2')));

  it('member can cancel and free the seat', async () => {
    const db = as('m1');
    await book(db, 'c1', 'm1');
    await assertSucceeds(runTransaction(db, async (tx) => {
      const c = await tx.get(doc(db, 'classes/c1'));
      tx.update(doc(db, 'classes/c1'), { bookedCount: c.data().bookedCount - 1 });
      tx.delete(doc(db, 'bookings/c1_m1'));
    }));
  });

  it('cannot delete a booking without releasing the seat', async () => {
    await book(as('m1'), 'c1', 'm1');
    await assertFails(deleteDoc(doc(as('m1'), 'bookings/c1_m1')));
  });
});
