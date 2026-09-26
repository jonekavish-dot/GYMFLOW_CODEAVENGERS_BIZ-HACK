# GymFlow web app (frontend)

React 19 + Vite. `npm install && npm run dev` (proxies `/api` to the backend on :8000); `npm run build` writes `dist/`.

```
public/               manifest, service worker, icons (installable PWA)
src/
├── main.jsx · App.jsx    entry and route table
├── api/                  fetch client with silent token refresh, TanStack Query hooks
├── auth/                 auth context, session restore, role guards
├── components/           shell/layouts, data table, modal, toast, charts, QR, exports
├── lib/                  formatting, exports, receipts, QR scanning, PWA, theme
├── pages/
│   ├── Login.jsx
│   ├── admin/            Dashboard, Members, Attendance, Slots, Check-in desk, Classes,
│   │                     Plans, Trainers, Payments, Analytics, Settings
│   └── member/           Membership, Gym slots, Classes, Check in, Activity
└── styles/               plain CSS split by concern (base, layout, components, mobile, ...)
```
