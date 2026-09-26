# Evaluator guide

A five-minute path through GymFlow (PS76 · BIZ HACK '26).

## 1. Run it (local, no accounts needed)

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
python -m app.seed_demo --reset                     # demo data, local SQLite file
uvicorn app.main:app --reload                       # API + docs: http://127.0.0.1:8000/api/docs

cd ../frontend && npm install && npm run dev        # app: http://localhost:5173
```

| Role | Email | Password |
|---|---|---|
| Admin | `admin@gymflow.test` | `admin123` |
| Member | `member@gymflow.test` | `member123` |

## 2. Where to look

| Requirement | Where |
|---|---|
| Membership plans, members, renewals, payments | `backend/app/routers/{plans,members}.py` · `frontend/src/pages/admin/{Plans,Members,Payments}.jsx` |
| Class & slot booking (capacity, no double-booking, trainer overlap) | `backend/app/routers/{classes,slots}.py` |
| Attendance + exercises | `backend/app/routers/attendance.py` |
| QR / OTP front-desk check-in | `backend/app/routers/checkins.py` · `frontend/src/pages/admin/CheckinDesk.jsx` · `frontend/src/pages/member/CheckIn.jsx` |
| JWT access + rotating refresh tokens, RBAC | `backend/app/security.py` · `deps.py` · `routers/auth.py` |
| Business rules under test | `backend/tests/` |

## 3. Verify

```bash
cd backend && python -m pytest -q      # 45 tests
cd frontend && npm run build           # production bundle
```

CI (`.github/workflows/ci.yml`) runs the same suite on SQLite and a real PostgreSQL, then builds the frontend.

## 4. Configuration

Templates only; real values are never committed.

- `backend/.env.example`: local development
- `backend/.env.production.example`: variables to set on the host (Vercel + Neon)
