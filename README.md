# PS76 — Gym Membership & Class Booking (BIZ HACK '26)

Vanilla JS (ES modules, no build step) + Firebase Auth + Firestore, deployed on Firebase Hosting.
Kept separate from the existing A.S. Fitness portal in `../public`, so deploying this never touches the live gym data or rules.

```
ps76/
├── firebase.json            hosting + firestore rules/indexes + emulator ports
├── .firebaserc              → set your PS76 project id
├── firestore.rules          role split, capacity-safe booking, expiry enforcement
├── firestore.indexes.json
├── public/
│   ├── index.html           login + one-time "create first admin" setup
│   ├── admin.html           admin portal (plans, members, classes, alerts, occupancy)
│   ├── member.html          member portal (validity, goals, booking)
│   ├── css/app.css
│   └── js/
│       ├── firebase-config.js   ← paste your web app config here
│       ├── firebase.js          init (SDK 12.19.0), secondary-auth helper, connection probe
│       ├── auth.js              sign in/out, role lookup, requireRole() page guard, bootstrap
│       ├── ui.js                DOM helpers, toasts, tabs
│       ├── pages/               login.js · admin.js · member.js
│       └── services/            plans · members · classes · bookings · checkins · ai (Gemini)
└── tests/                   Firestore rules tests (emulator)
```

## Auth & roles

- Role is stored in `users/{uid}.role` (`admin` | `member`). Only admins can write it, so members can't promote themselves.
- **First admin:** on a fresh project, the login page shows a "First-time setup" form. It creates the account plus `config/bootstrap` in a single batch. The rules allow that only once.
- **Members** don't sign themselves up. An admin registers them under Members → Register, which creates their login and membership. The admin stays signed in because a secondary Auth instance handles the new account.
- Every protected page calls `requireRole('admin' | 'member')`. It sends signed-out users to login and users with the wrong role to their own portal.

## Setup (≈5 min)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (e.g. `ps76-gym`).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode, `asia-south1`).
4. **Project settings → Your apps → Web (`</>`)** → copy the config into `public/js/firebase-config.js`.
5. Put the project id in `.firebaserc`, then:
   ```bash
   npm i -g firebase-tools
   firebase login
   cd ps76
   firebase deploy --only firestore:rules,firestore:indexes,hosting
   ```
6. Open the hosted URL → create the admin → add a plan → register a member → sign in as that member.
7. (For AI recommendations) **Build → AI Logic → Get started → Gemini Developer API**. No API key goes in the code.

Local dev without touching the cloud: set `USE_EMULATORS = true` in `firebase-config.js`, then run `firebase emulators:start` in `ps76/` and open http://127.0.0.1:5000.

## Tests

```bash
cd ps76/tests && npm install && npm test   # needs Java for the Firestore emulator
```
Covers: bootstrap only once, no self-promotion, member can't extend their own expiry, admin-only plans/classes, no overbooking, expired members can't book, no seat changes without a matching booking.

## Next steps

- QR check-in: render `qrPayload(uid)` on the member page; admin scanner → `checkIn(uid)` (`services/checkins.js`)
- Occupancy dashboard: `watchOccupancy()` is already wired to the admin KPI; add check-out + chart
- Gemini: call `recommendClasses(goals, classes)` from the member page (`services/ai.js`)
- Expiry alerts: live on both portals now (≤ 7 days / expired); add email or WhatsApp later if time allows
