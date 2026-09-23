// Gym profile (config/gym) plus the local theme preference.
import { doc, onSnapshot, setDoc } from '../../core/sdk/firestore.js';
import { db } from '../../core/firebase.js';

const ref = doc(db, 'config', 'gym');
const THEME_KEY = 'gymflow_theme';

export function watchGym(cb) {
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : {}), () => cb({}));
}

export function saveGym(profile) {
  return setDoc(ref, profile, { merge: true });
}

export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch { return 'dark'; }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode — theme stays for this page only */ }
}
