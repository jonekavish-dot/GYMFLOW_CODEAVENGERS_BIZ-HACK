// Paste the web app config from:
// Firebase Console → Project settings → General → Your apps → Web app → SDK setup and configuration → Config
//
// These values are not secrets (they identify the project, they don't grant access);
// access is controlled by firestore.rules. Keep the Gemini key OUT of this file —
// AI calls go through Firebase AI Logic (see js/services/ai.js).
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Set to true to run against `firebase emulators:start` instead of the live project.
export const USE_EMULATORS = false;
