// Paste the web app config from:
// Firebase Console → Project settings → General → Your apps → Web app → SDK setup and configuration → Config
//
// These values are not secrets (they identify the project, they don't grant access);
// access is controlled by firestore.rules. Keep the Gemini key OUT of this file —
// AI calls go through Firebase AI Logic (see js/services/ai.js).
export const firebaseConfig = {
  apiKey: 'AIzaSyCKGMUMeaYfBBwXM68PJw9k89QegwZRuG8',
  authDomain: 'ps76-gym.firebaseapp.com',
  projectId: 'ps76-gym',
  storageBucket: 'ps76-gym.firebasestorage.app',
  messagingSenderId: '847680492592',
  appId: '1:847680492592:web:87180dc9c47b93429009f5',
  measurementId: 'G-195X0YYGDJ',
};

// Set to true to run against `firebase emulators:start` instead of the live project.
export const USE_EMULATORS = false;
