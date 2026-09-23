import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as fbSignOut, sendPasswordResetEmail, deleteUser,
} from './sdk/auth.js';
import {
  doc, getDoc, writeBatch, serverTimestamp,
} from './sdk/firestore.js';
import { auth, db } from './firebase.js';

export const ROLES = { ADMIN: 'admin', MEMBER: 'member' };
const HOME = { admin: 'admin.html', member: 'member.html' };

/** Resolves once with the current Firebase user (or null) after Auth restores its session. */
export function currentUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user); });
  });
}

/** Role lives in users/{uid}; only admins can write it (see firestore.rules). */
export async function getProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export function homeFor(role) {
  return HOME[role] || 'index.html';
}

export async function signIn(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getProfile(user.uid);
  if (!profile || !HOME[profile.role]) {
    await fbSignOut(auth);
    throw Object.assign(new Error('This account has no role assigned. Ask an admin to register you.'), { code: 'app/no-role' });
  }
  return profile;
}

let signingOut = false;

export async function signOut() {
  signingOut = true;
  await fbSignOut(auth);
  location.replace('index.html');
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

/**
 * Page guard. Call at the top of every protected page.
 * Redirects to login when signed out, or to the user's own portal on a role mismatch.
 */
export async function requireRole(role) {
  const user = await currentUser();
  if (!user) {
    location.replace('index.html');
    return new Promise(() => {}); // halt the page while navigating
  }
  const profile = await getProfile(user.uid).catch(() => null);
  if (!profile) {
    await fbSignOut(auth);
    location.replace('index.html?e=no-role');
    return new Promise(() => {});
  }
  if (profile.role !== role) {
    location.replace(homeFor(profile.role));
    return new Promise(() => {});
  }
  // A later sign-out in another tab should kick this tab back to login.
  onAuthStateChanged(auth, (u) => { if (!u && !signingOut) location.replace('index.html'); });
  return { user, profile };
}

/**
 * One-time setup: creates the very first admin. The rules only accept this while
 * config/bootstrap does not exist, and require both docs in the same batch.
 */
export async function bootstrapFirstAdmin({ name, email, password }) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', user.uid), { role: ROLES.ADMIN, email, name, createdAt: serverTimestamp() });
    batch.set(doc(db, 'config', 'bootstrap'), { adminUid: user.uid, createdAt: serverTimestamp() });
    await batch.commit();
  } catch (e) {
    // Someone else finished setup first (or rules not deployed) — don't leave an orphan login behind.
    await deleteUser(user).catch(() => {});
    throw e;
  }
  return getProfile(user.uid);
}

export function authErrorMessage(e) {
  const map = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'Wrong email or password.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'auth/network-request-failed': 'No internet connection.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/operation-not-allowed': 'Email/Password sign-in is disabled — enable it in Console → Authentication → Sign-in method.',
    'auth/configuration-not-found': 'Authentication is not set up — Console → Authentication → Get started.',
    'permission-denied': 'Permission denied by Firestore rules.',
  };
  return map[e.code] || e.message || 'Something went wrong.';
}
