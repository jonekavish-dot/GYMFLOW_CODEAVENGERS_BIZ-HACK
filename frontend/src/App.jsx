import { Navigate, Route, Routes } from 'react-router-dom';
import { homeFor, useAuth } from './auth/AuthContext';
import { AdminLayout, MemberLayout } from './components/Layouts';
import Login from './pages/Login';
import Analytics from './pages/admin/Analytics';
import Attendance from './pages/admin/Attendance';
import CheckinDesk from './pages/admin/CheckinDesk';
import Classes from './pages/admin/Classes';
import Dashboard from './pages/admin/Dashboard';
import Members from './pages/admin/Members';
import Payments from './pages/admin/Payments';
import Plans from './pages/admin/Plans';
import Settings from './pages/admin/Settings';
import Slots from './pages/admin/Slots';
import Trainers from './pages/admin/Trainers';
import Activity from './pages/member/Activity';
import CheckIn from './pages/member/CheckIn';
import MemberClasses from './pages/member/MemberClasses';
import MemberSlots from './pages/member/MemberSlots';
import Membership from './pages/member/Membership';

function Splash() {
  return <div className="splash">Loading…</div>;
}

/** Signed out goes to login; the wrong role goes to its own portal. */
function RequireRole({ role, children }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status !== 'authed') return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function Home() {
  const { status, user } = useAuth();
  if (status === 'loading') return <Splash />;
  return <Navigate to={status === 'authed' ? homeFor(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
        <Route index element={<Dashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="slots" element={<Slots />} />
        <Route path="checkin" element={<CheckinDesk />} />
        <Route path="classes" element={<Classes />} />
        <Route path="plans" element={<Plans />} />
        <Route path="trainers" element={<Trainers />} />
        <Route path="payments" element={<Payments />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="/member" element={<RequireRole role="member"><MemberLayout /></RequireRole>}>
        <Route index element={<Membership />} />
        <Route path="slots" element={<MemberSlots />} />
        <Route path="classes" element={<MemberClasses />} />
        <Route path="checkin" element={<CheckIn />} />
        <Route path="activity" element={<Activity />} />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
