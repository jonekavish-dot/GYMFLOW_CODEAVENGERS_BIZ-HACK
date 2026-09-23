// Single place that initialises Firebase. Every other module imports from here,
// so the SDK version is pinned in exactly one spot.
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  connectFirestoreEmulator, doc, getDocFromServer,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, USE_EMULATORS } from './firebase-config.js';

export const isConfigured = !Object.values(firebaseConfig).some((v) => String(v).includes('YOUR_'));

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// A throwaway app instance lets an admin create another user's Auth account
// without the admin being signed out of the main instance.
export async function withSecondaryAuth(fn) {
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondary);
  if (USE_EMULATORS) connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  try {
    return await fn(secondaryAuth);
  } finally {
    await deleteApp(secondary);
  }
}

/**
 * Real connectivity probe. Reads config/bootstrap, which the rules make publicly
 * readable, so it works before sign-in and tells apart the failure modes that the
 * old portal lumped together as "not connected".
 * @returns {Promise<{ok: boolean, state: string, message: string, bootstrapped?: boolean}>}
 */
export async function checkConnection() {
  if (!isConfigured) {
    return { ok: false, state: 'unconfigured', message: 'Firebase config missing — edit public/js/firebase-config.js' };
  }
  try {
    const snap = await getDocFromServer(doc(db, 'config', 'bootstrap'));
    return { ok: true, state: 'connected', message: `Connected · ${firebaseConfig.projectId}`, bootstrapped: snap.exists() };
  } catch (e) {
    const byCode = {
      'permission-denied': 'Firestore rules rejected the probe — deploy firestore.rules (firebase deploy --only firestore:rules)',
      'unavailable': 'Cannot reach Firestore — offline, or the Firestore database has not been created yet',
      'failed-precondition': 'Firestore database not created — Console → Build → Firestore Database → Create database',
      'not-found': 'Firestore database not found for this project',
    };
    return { ok: false, state: e.code || 'error', message: byCode[e.code] || e.message };
  }
}
