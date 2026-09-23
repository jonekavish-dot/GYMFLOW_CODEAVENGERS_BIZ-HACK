# GymFlow — PS76 · BIZ HACK '26

Gym membership & class booking system. Vanilla JS (ES modules, no build step) on Firebase Auth + Firestore + Hosting.

- **Admin portal:** membership plans, member registration, class scheduling with capacity, expiry alerts, live occupancy.
- **Member portal:** membership validity, class booking/cancelling with live seat counts, goals (these feed the AI recommendations).
- **One login page** for both roles. Users are routed by the role stored in Firestore.

## Structure

```
ps76/
├── firebase.json · .firebaserc      hosting + rules + emulator config (project: ps76-gym)
├── firestore.rules                  roles, capacity-safe booking, expiry enforcement
├── firestore.indexes.json
├── package.json                     npm test · npm run deploy · npm run serve
├── tests/rules.test.js              Firestore rules tests (emulator)
├── tools/deploy.cjs                 deploy via Firebase REST APIs (works with an Admin SDK key)
└── public/                          ← what gets hosted
    ├── index.html · admin.html · member.html   thin shells; each loads one entry script
    ├── assets/css/
    │   ├── base.css                 tokens, reset, keyframes
    │   ├── components.css           KPI cards, panels, forms, buttons, tables, badges, toasts
    │   ├── layout.css               portal shell: sidebar, topbar, pages, mobile nav
    │   └── auth.css                 login page
    └── js/
        ├── config/
        │   ├── app.config.js        product name / tagline — rename the app here
        │   └── firebase.config.js   Firebase web config
        ├── core/
        │   ├── sdk/                 Firebase SDK re-exports (version pinned here)
        │   ├── firebase.js          app/auth/db init, secondary auth, connection probe
        │   └── auth.js              sign in/out, roles, requireRole() guard, first-admin bootstrap
        ├── shared/
        │   ├── shell.js             builds sidebar/topbar/pages/mobile nav from a module list
        │   ├── dom.js · format.js · toast.js · forms.js
        ├── modules/                 one folder per feature: *.service.js = data, *.view.js = UI
        │   ├── dashboard/           admin KPIs, expiry alerts, occupancy
        │   ├── members/             member registration + list (service used by others too)
        │   ├── plans/               membership plans
        │   ├── classes/             class scheduling
        │   ├── membership/          member: validity, expiry banner, goals
        │   ├── bookings/            member: book / cancel (transaction + rules)
        │   ├── checkins/            QR check-in + occupancy (service; UI next)
        │   └── ai/                  Gemini recommendations via Firebase AI Logic (service; UI next)
        └── entries/                 page entry points: login.js · admin.js · member.js
```

### Adding a feature

1. Create `js/modules/<feature>/<feature>.service.js` (Firestore reads/writes) and `<feature>.view.js`:
   ```js
   export default {
     id: 'feature', title: 'Page Title', label: 'Nav Label', icon: '✨', section: 'Main',
     template: () => `<div class="panel">…</div>`,
     init({ el, user, profile, shell }) { /* wire listeners, scoped to el */ },
   };
   ```
2. Add it to the `modules` list in `js/entries/admin.js` or `member.js`. The sidebar, mobile nav and page are generated for you.

## Auth & roles

- The role lives in `users/{uid}.role` (`admin` | `member`). Only admins can write it.
- **First admin:** on a fresh project, the login page shows a one-time setup form. The rules allow exactly one bootstrap.
- **Members** are registered by an admin, who creates their login. The admin stays signed in because a secondary Auth instance handles the new account.
- Every portal page calls `requireRole()`. Signed-out users go to login, and users with the wrong role go to their own portal.

## Run, test, deploy

```bash
cd ps76
npm install
npm test                                  # rules tests (needs Java for the emulator)
npm run serve                             # local emulators; set USE_EMULATORS = true in firebase.config.js
GOOGLE_APPLICATION_CREDENTIALS=key.json npm run deploy   # rules + indexes + hosting → https://ps76-gym.web.app
```

No Node on your machine? Serve `public/` with `python -m http.server 5000` and open http://localhost:5000. It talks to the live project.

**CI:** `.github/workflows/ps76.yml` runs the rules tests on every push/PR that touches `ps76/`. It deploys on pushes to `main` when the repo secret `FIREBASE_SERVICE_ACCOUNT_PS76_GYM` is set. Never commit or paste service-account keys.

## Next steps

- QR check-in: member shows `qrPayload(uid)`, admin scans → `checkIn(uid)` (`modules/checkins`)
- Occupancy dashboard: check-out + live chart on top of `watchOccupancy()`
- Gemini: "Recommend classes" on the member portal using `recommendClasses(goals, classes)` (`modules/ai`)
