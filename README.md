# GymFlow

**Gym membership, class & slot booking, attendance and front-desk check-in — built for PS76, BIZ HACK '26.**

A dual-portal system on Firebase: an **Admin Console** for running the gym day to day, and a **Member Portal** for booking, checking in and tracking progress. No backend server — Firebase Auth + Firestore + Hosting, secured entirely by Firestore security rules, deployed as an installable web app.

**Live:** https://ps76-gym.web.app

---

## Features

**Admin Console**
- Membership plans, member registration and renewals
- Class scheduling and gym workout **slots** with trainer-conflict detection — no two slots for the same trainer can overlap
- Daily **attendance** roll call with exercise categories (A–F) plus custom exercises
- **Front-desk check-in desk**: generate a QR + 6-digit code with admin-set validity (minutes or hours); see who's inside live, and check people out
- Trainers, payments & revenue ledger, analytics dashboards, gym settings

**Member Portal**
- Membership status, goals, and AI class recommendations (Gemini via Firebase AI Logic)
- Book classes and gym slots with live seat counts
- **Self-check-in** by scanning the front-desk QR or typing the code — flows straight into picking today's exercises, which shows up live on the admin's Attendance tab
- Personal attendance history, streaks, and payment receipts

**Platform**
- Installable as an app via Chrome's install prompt (manifest + service worker)
- Fully responsive — data tables become cards on phones, a raised scanner button anchors the mobile nav
- Every write is enforced by Firestore rules, not just the UI: capacity limits, one-booking-per-member, active-membership checks, and code expiry are all checked server-side

---

## Screenshots

### Sign in
One login page for both roles — admins and members land in the right portal automatically.

![Sign in](docs/screenshots/01-login.png)

### Admin Console

| Dashboard | Members |
|---|---|
| ![Admin dashboard](docs/screenshots/02-admin-dashboard.png) | ![Members](docs/screenshots/03-admin-members.png) |

| Gym Slots | Attendance |
|---|---|
| ![Slots](docs/screenshots/04-admin-slots.png) | ![Attendance](docs/screenshots/05-admin-attendance.png) |

| Check-In Desk | Classes |
|---|---|
| ![Check-in desk](docs/screenshots/06-admin-checkin-desk.png) | ![Classes](docs/screenshots/07-admin-classes.png) |

| Plans | Trainers |
|---|---|
| ![Plans](docs/screenshots/08-admin-plans.png) | ![Trainers](docs/screenshots/09-admin-trainers.png) |

| Payments & Revenue | Analytics |
|---|---|
| ![Payments](docs/screenshots/10-admin-payments.png) | ![Analytics](docs/screenshots/11-admin-analytics.png) |

**Settings**

![Settings](docs/screenshots/12-admin-settings.png)

### Member Portal

| My Membership | Gym Slots |
|---|---|
| ![Membership](docs/screenshots/13-member-membership.png) | ![Member slots](docs/screenshots/14-member-slots.png) |

| Book Classes | My Activity |
|---|---|
| ![Classes](docs/screenshots/15-member-classes.png) | ![Activity](docs/screenshots/16-member-activity.png) |

### Mobile

The scanner button rides above the bottom nav, raised and centered — tap it to check in by scanning the front-desk QR or typing its code.

| Mobile nav | Check In |
|---|---|
| ![Mobile nav with scanner FAB](docs/screenshots/17-mobile-nav-fab.png) | ![Check in](docs/screenshots/18-mobile-checkin.png) |

### Sign out

Logging out returns to the same shared sign-in page.

![Logged out](docs/screenshots/19-logout.png)

---

## Structure

```
.
├── firebase.json · .firebaserc      hosting + rules + emulator config (project: ps76-gym)
├── firestore.rules                  roles, capacity-safe booking, check-in codes, expiry
├── firestore.indexes.json
├── package.json                     npm test · npm run deploy · npm run serve
├── tests/rules.test.js              Firestore rules tests (emulator) — 50+ tests
├── tools/deploy.cjs                 deploy via Firebase REST APIs (works with an Admin SDK key)
└── public/                          ← what gets hosted
    ├── index.html · admin.html · member.html   thin shells; each loads one entry script
    ├── manifest.webmanifest · sw.js             PWA install + offline shell caching
    ├── assets/css/                              tokens, components, layout, mobile, auth
    └── js/
        ├── config/            app identity + Firebase web config
        ├── core/               app/auth/db init, secondary auth, PWA install, connection probe
        ├── shared/              shell (sidebar/nav/FAB), table, modal, charts, export, receipt,
        │                        QR encode/scan, idle auto-logout, toast, forms
        ├── modules/            one folder per feature — *.service.js (Firestore) + *.view.js (UI)
        │   ├── dashboard/ · members/ · plans/ · classes/ · slots/ · trainers/
        │   ├── attendance/ · checkin/ · payments/ · analytics/ · settings/
        │   ├── membership/ · bookings/ · activity/ · ai/
        └── entries/            page entry points: login.js · admin.js · member.js
```

## Data model

| Collection | Doc id | Notes |
|---|---|---|
| `users` | uid | `role: admin \| member` — only admins write it |
| `members` | uid | plan, expiry, exercise category, payments-to-date |
| `plans` | auto | `durationDays`, `price`, `active` |
| `classes` / `bookings` | auto / `{classId}_{uid}` | capacity-safe booking via transaction + rules |
| `slots` / `slot_bookings` | auto / `{slotId}_{uid}` | gym workout slots; trainer-overlap checked before create |
| `attendance` | `{date}_{uid}` | one doc per person-day; members can self-mark present with ≥1 exercise |
| `checkins` | auto | `config/checkinSession` holds the one active admin-issued code + expiry |
| `payments` | auto | append-only revenue ledger (joins + renewals) |
| `trainers` | auto | staff roster |
| `config` | `bootstrap` `gym` `exercises` `checkinSession` | setup marker, gym profile, exercises, check-in code |

## Auth & roles

- Role lives in `users/{uid}.role` (`admin` \| `member`); only admins can write it.
- **First admin:** on a fresh project, the login page shows a one-time setup form — the rules allow exactly one bootstrap.
- Members are registered by an admin, who creates their login via a secondary Auth instance so the admin's own session stays intact.
- Every page calls `requireRole()`: signed-out → login; wrong role → their own portal.
- 3-minute inactivity auto-logout on both portals.

## Run, test, deploy

```bash
npm install
npm test                                  # rules tests (needs Java for the emulator)
npm run serve                             # local emulators; set USE_EMULATORS = true in firebase.config.js
GOOGLE_APPLICATION_CREDENTIALS=key.json npm run deploy   # rules + indexes + hosting → https://ps76-gym.web.app
```

**CI:** `.github/workflows/ci.yml` runs the rules tests on every push/PR, and deploys on pushes to `main` when the repo secret `FIREBASE_SERVICE_ACCOUNT_PS76_GYM` is set.

## Security model

Every meaningful write is enforced by `firestore.rules`, not just hidden in the UI:
- A member can only book a class/slot if their membership is active, and only into one seat — capacity is checked and incremented atomically together with the booking record.
- A member can only self-check-in with the exact code currently in `config/checkinSession`, and only before it expires — checked server-side against `request.time`.
- A member can only mark **themselves** present, and only with at least one exercise chosen; marking absent, backdating, or editing someone else's row stays admin-only.
- Trainer double-booking across overlapping time windows is rejected before a slot is even created.
