# GymFlow API (backend)

FastAPI + SQLAlchemy 2 + PostgreSQL. Run from this folder: `uvicorn app.main:app --reload` (docs at `/api/docs`).

```
app/
├── main.py           app factory, security headers, error shape, serves the built SPA
├── config.py         settings from the environment (see .env.example)
├── db.py             engine (SQLite locally, Postgres/Neon in production), session dependency
├── models.py         all tables
├── schemas.py        request / response models
├── security.py       bcrypt hashing + JWT access/refresh tokens
├── deps.py           current-user + role (RBAC) dependencies
├── ratelimit.py      failed-attempt limiter used by login and check-in codes
├── timeutil.py       gym-local "today" helpers
├── routers/          one module per feature: auth, members, plans (+payments), classes,
│                     slots, trainers, attendance, checkins, settings
├── init_db.py        `python -m app.init_db`  creates any missing tables
└── seed_demo.py      `python -m app.seed_demo --reset`  demo data for local runs
tests/                pytest suite (SQLite by default, real Postgres with TEST_DATABASE_URL)
```

Dependencies are declared once in the repo-root `requirements.txt` (Vercel only reads that one);
`requirements.txt` here just includes it and `requirements-dev.txt` adds the test tools.
