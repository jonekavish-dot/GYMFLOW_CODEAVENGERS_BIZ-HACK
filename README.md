# GymFlow

**Gym membership, class & slot booking, attendance and front-desk check-in — built for PS76, BIZ HACK '26.**

A dual-portal web app: an **Admin Console** for running the gym day to day and a **Member Portal** for booking, checking in and tracking progress. **FastAPI** (Python) serves a JSON API secured with **JWT access + rotating refresh tokens** and role-based access control; a **React** single-page app (built with Node/Vite) is the interface; **PostgreSQL** stores the data. It installs as an app from Chrome.

| Layer | Technology |
|---|---|
| API | FastAPI · SQLAlchemy 2 · Pydantic v2 · PyJWT · bcrypt |
| Database | PostgreSQL (Neon or any Postgres); SQLite for local development |
| Frontend | React 19 · React Router · TanStack Query · Chart.js |
| Tooling | Node 22 + Vite (build/dev server), pytest |

> **Evaluating this project?** Start with [docs/EVALUATION.md](docs/EVALUATION.md): run steps, demo logins and where each requirement lives.

---

## Features

**Admin Console**
- Membership plans, member registration and renewals (expired memberships restart today, active ones stack)
- Class scheduling and gym workout **slots** with capacity limits and **trainer-conflict detection** — a trainer can't run two overlapping slots
- Daily **attendance** roll call with exercise categories A–F plus custom exercises
- **Front-desk check-in desk**: generate a QR + 6-digit code with admin-chosen validity (minutes or hours), see who's inside live, check people out
- Trainers, payments & revenue ledger with printable receipts, analytics dashboards, CSV / Excel / PDF exports, gym settings

**Member Portal**
- Membership status and expiry alerts, goals, class booking with live seat counts, gym slot booking
- **Self-check-in** by scanning the front-desk QR or typing the code — flows straight into choosing today's exercises, which appear live on the admin's Attendance tab
- Personal attendance history, streaks, payment receipts

**Security**
- Short-lived **access tokens** (15 min, held in memory only) + **rotating refresh tokens** in an httpOnly, SameSite cookie; replaying a used refresh token revokes the whole session family
- **RBAC** on every route (`admin` / `member`), checked against the database so demoting or disabling a user is immediate
- bcrypt password hashing, login and check-in-code **rate limiting**, uniform "wrong email or password" responses, password change signs out every other device
- Business rules are enforced **server-side**: capacity is taken with one atomic conditional `UPDATE`, memberships must be active to book or check in, check-in codes expire on their own, and a member can only mark *themselves* present — for today, with at least one exercise, and only after checking in

**Platform**
- Installable via Chrome's install prompt (manifest + service worker that never caches API data)
- Fully responsive — tables become cards on phones, and a raised scanner button anchors the mobile nav
- Interactive API docs at `/api/docs`

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
| ![Mobile nav with scanner button](docs/screenshots/17-mobile-nav-fab.png) | ![Check in](docs/screenshots/18-mobile-checkin.png) |

### Sign out

Logging out returns to the shared sign-in page.

![Logged out](docs/screenshots/19-logout.png)

### API

FastAPI documents itself; try every endpoint at `/api/docs`.

![API docs](docs/screenshots/20-api-docs.png)

---

## Run it locally

You need **Python 3.11+** and **Node 20+**.

```bash
# 1. Backend
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt
python -m app.seed_demo --reset   # optional demo data (creates a local SQLite file)
uvicorn app.main:app --reload     # http://127.0.0.1:8000  ·  API docs at /api/docs

# 2. Frontend (a second terminal), hot-reloading, proxying /api to the backend
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

Demo logins after seeding: `admin@gymflow.test` / `admin123` and `member@gymflow.test` / `member123`.
On an empty database the login page shows a one-time **first-admin setup** form instead.

To run everything as one process, build the SPA and let FastAPI serve it:

```bash
cd frontend && npm run build      # writes frontend/dist
cd ../backend && uvicorn app.main:app     # http://127.0.0.1:8000 serves the app and the API
```

## Configuration

Copy `backend/.env.example` to `backend/.env`. Everything has a development default except `JWT_SECRET` in production.

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Any SQLAlchemy URL. A Neon/Postgres URL works as-is | `sqlite:///./gymflow.db` |
| `JWT_SECRET` | Signs tokens. **Required in production**, 32+ random characters | dev-only value |
| `APP_ENV` | `production` refuses to start with a weak `JWT_SECRET` | `development` |
| `ACCESS_TOKEN_MINUTES` / `REFRESH_TOKEN_DAYS` | Token lifetimes | `15` / `7` |
| `APP_TIMEZONE` | The gym's local day drives attendance and expiry | `Asia/Kolkata` |
| `COOKIE_SECURE` | `true` behind HTTPS so the refresh cookie never travels over HTTP | `false` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | Connection pool per process | `5` / `5` |
| `CORS_ORIGINS` | Comma-separated; only if the SPA is served from another origin | *(empty)* |

Generate a secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

### Using Neon

Create a project at [neon.tech](https://neon.tech), copy its connection string, and set:

```
DATABASE_URL=postgresql://user:password@ep-your-project.neon.tech/neondb?sslmode=require
```

The `postgresql://` form is fine; the driver is filled in automatically. Tables are created on startup, and the pool checks each connection before use because Neon suspends idle compute.

## Deploying (free: Vercel + Neon)

The repo is set up for [Vercel](https://vercel.com) (Hobby plan) with a [Neon](https://neon.tech) Postgres database. Vercel serves the React build as static files and runs the FastAPI app as a serverless function (`api/index.py`, routed by `vercel.json`).

1. **Neon:** create a project (Singapore is closest to India), copy the **direct** connection string (turn *Connection pooling* off), then create the tables once from your machine:
   ```bash
   cd backend
   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" python -m app.init_db
   ```
2. **Vercel:** *Add New > Project*, import this GitHub repo, set **Framework Preset: Other** (leave everything else; `vercel.json` provides the build), and add these environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon string |
   | `JWT_SECRET` | a random 32+ character string (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
   | `APP_ENV` | `production` |
   | `COOKIE_SECURE` | `true` |
   | `APP_TIMEZONE` | `Asia/Kolkata` |
   | `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `2` / `2` (serverless runs many small instances) |

3. **Deploy.** Every push to `main` redeploys. On first visit, the login page shows the one-time admin setup form.

Notes: Vercel doesn't run startup hooks, so run `python -m app.init_db` after adding a table (there is no migration tool yet; add Alembic before altering columns on real data). The login and check-in-code rate limiters are per instance, so on serverless they slow guessing rather than fully stopping it. Vercel's Hobby plan is for non-commercial use.

Any host that runs a Python web process also works: `cd frontend && npm ci && npm run build`, then `cd backend && uvicorn app.main:app` serves the API and the built app together on one port.

## Tests

```bash
cd backend
python -m pytest -q                                                    # SQLite, in memory
TEST_DATABASE_URL=postgresql://user:pass@localhost/gymflow_test python -m pytest -q   # real Postgres
```

45 tests cover the JWT/refresh lifecycle (rotation, replay revocation, logout, password change), RBAC on every role boundary, class and slot capacity and overlap rules, membership expiry and renewal maths, check-in code validity and rate limiting, and the self-attendance rules. CI runs the suite on SQLite **and** PostgreSQL, then builds the frontend.

## Project layout

```
.
├── backend/
│   ├── app/
│   │   ├── main.py          FastAPI app, security headers, serves the built SPA
│   │   ├── config.py        settings from the environment
│   │   ├── db.py · models.py   engine, timestamptz handling, SQLAlchemy models
│   │   ├── security.py      bcrypt + JWT creation/verification
│   │   ├── deps.py          auth + RBAC dependencies
│   │   ├── ratelimit.py     failed-attempt limiter (login, check-in codes)
│   │   ├── schemas.py       request/response models
│   │   ├── routers/         auth · members · plans(+payments) · classes · slots · trainers
│   │   │                    attendance · checkins · settings
│   │   └── seed_demo.py     demo data
│   ├── tests/
│   ├── .env.example · .env.production.example   config templates (real .env files are git-ignored)
│   └── README.md
├── api/index.py             Vercel serverless entry (wraps backend/app)
├── docs/                    EVALUATION.md + screenshots
├── requirements.txt         backend dependencies (repo root, where Vercel reads them)
├── vercel.json              Vercel build + routing
└── frontend/
    ├── public/              manifest, service worker, icons
    └── src/
        ├── api/             fetch client (silent token refresh) + query hooks
        ├── auth/            auth context, session restore
        ├── components/      shell, tables, modals, charts, QR
        ├── lib/             formatting, exports, receipts, QR scanning
        └── pages/           admin/* and member/*
```

## Data model

`users` (role) · `refresh_tokens` (rotation families) · `members` · `plans` · `payments` (append-only ledger) · `classes` + `class_bookings` · `slots` + `slot_bookings` · `trainers` · `attendance` (one row per person per day) · `checkins` · `checkin_session` (the one active code) · `settings`.

## History

The first version of GymFlow ran on Firebase (Auth + Firestore + Hosting). It is preserved at the [`firebase-final`](../../tree/firebase-final) tag.
