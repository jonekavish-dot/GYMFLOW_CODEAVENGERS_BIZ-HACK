import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { APP } from '../lib/app';
import { fmtLongNow, initials } from '../lib/format';
import { useInstall } from '../lib/pwa';
import { useIdleLogout } from './useIdleLogout';

// Corner brackets + barcode glyph for the raised scanner button, drawn as SVG so it looks
// identical on every device instead of depending on an emoji font.
const SCAN_ICON = (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2" />
    <path d="M8 9v6M11 9v6M14 9v6M17 9v6" strokeWidth="1.6" />
  </svg>
);

/**
 * Portal chrome: sidebar, topbar, page outlet, and the mobile bottom nav.
 * nav: [{ to, label, title, icon, section, badge?, fab? }]. One item may set `fab` to become the
 * raised center button on phones (still a normal sidebar link on desktop).
 */
export function Shell({ roleLabel, subtitle, nav }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const { canInstall, install } = useInstall();
  const idleLeft = useIdleLogout(logout);
  const [now, setNow] = useState(fmtLongNow());

  useEffect(() => {
    const t = setInterval(() => setNow(fmtLongNow()), 30000);
    return () => clearInterval(t);
  }, []);

  const current = [...nav].sort((a, b) => b.to.length - a.to.length)
    .find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`)) || nav[0];

  useEffect(() => { document.title = `${APP.name} — ${roleLabel}`; }, [roleLabel]);
  // The mobile nav scrolls sideways when there are more tabs than fit; keep the active one visible.
  useEffect(() => {
    document.querySelector('.mob-nav-btn.active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [pathname]);

  const sections = [...new Set(nav.map((n) => n.section))];
  const rowNav = nav.filter((n) => !n.fab);
  const fab = nav.find((n) => n.fab);
  const cls = (base) => ({ isActive }) => `${base}${isActive ? ' active' : ''}`;

  return (
    <>
      <div className="app">
        <aside className="sidebar">
          <div className="sb-logo"><div className="brand">{APP.name}</div><div className="sub">{subtitle}</div></div>
          <nav className="sb-nav">
            {sections.map((sec) => (
              <div key={sec}>
                <div className="nav-sec">{sec}</div>
                {nav.filter((n) => n.section === sec).map((n) => (
                  <NavLink key={n.to} to={n.to} end className={cls('nav-item')}>
                    <span className="ni">{n.icon}</span>{n.label}
                    {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="owner-card">
            <div className="ow-av">{initials(user.name)}</div>
            <div className="ow-name">{user.name}</div>
            <div className="ow-title">{roleLabel}</div>
            <div className="ow-badges"><span className="ow-badge">{roleLabel}</span></div>
          </div>
          <div className="sb-foot">{APP.event}</div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="tb-left"><h2>{current.title}</h2><div className="dateline">{now}</div></div>
            <div className="tb-right">
              <span className="live-badge"><span className="live-dot" />Live</span>
              <span className="user-tag">
                <span className="av">{initials(user.name)}</span>
                <span className="who-txt"><span className="nm">{user.name}</span><span className="rl">{roleLabel}</span></span>
              </span>
              {canInstall && <button type="button" className="btn btn-ghost btn-sm" onClick={install}>⬇ Install</button>}
              <button type="button" className="btn btn-danger btn-sm" onClick={logout}>🔓 Logout</button>
            </div>
          </header>
          <section className="page" key={current.to}><Outlet /></section>
          <footer className="footer-bar"><span>{APP.name} · {APP.tagline}</span><span>Secured with <span className="hl">JWT</span></span></footer>
        </div>
      </div>

      <nav className="mobile-nav">
        <div className="mob-nav-grid">
          {rowNav.map((n) => (
            <NavLink key={n.to} to={n.to} end className={cls('mob-nav-btn')}>
              <span className="mob-icon">{n.icon}</span><span className="mob-label">{n.label}</span>
            </NavLink>
          ))}
        </div>
        {fab && <NavLink to={fab.to} end className={cls('mob-nav-fab')} aria-label={fab.label}>{SCAN_ICON}</NavLink>}
      </nav>

      {idleLeft !== null && <div className="idle-warn">⚠ Inactive — signing out in {idleLeft}s. Move the mouse to stay.</div>}
    </>
  );
}
