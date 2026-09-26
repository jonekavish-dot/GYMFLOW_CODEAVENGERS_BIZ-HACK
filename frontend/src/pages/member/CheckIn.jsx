import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { post, put } from '../../api/client';
import { LIVE, queries, useAction } from '../../api/hooks';
import { useToast } from '../../components/Toast';
import { DEFAULT_EXERCISES, exercisesFor } from '../../lib/exercises';
import { fmtDateTime, membershipStatus } from '../../lib/format';
import { startScanner } from '../../lib/qrscan';

/**
 * Scan the code on the front desk's screen or type its six digits. Checking in flows straight
 * into "what are you training today?", which files today's attendance (the server only accepts
 * that from someone who has checked in today).
 */
export default function CheckIn() {
  const open = useQuery({ ...queries.myOpenCheckin(), refetchInterval: LIVE });
  const me = useQuery(queries.me());
  const today = useQuery(queries.myToday());
  const custom = useQuery(queries.exercises());
  const toast = useToast();

  const isOpen = !!open.data;
  const canCheckIn = !!me.data && membershipStatus(me.data.expiry_date).key !== 'expired';

  const checkin = useAction((body) => post('/checkin/self', body), { invalidate: ['my-checkin', 'inside'], success: 'Checked in. Welcome! 💪' });
  const checkout = useAction((id) => post(`/checkin/${id}/checkout`), { invalidate: ['my-checkin', 'inside'], success: 'Checked out. See you next time!' });

  const [mode, setMode] = useState('scan');
  const [scanKey, setScanKey] = useState(0); // bump to restart the camera after a failed read
  const [scanError, setScanError] = useState('');
  const video = useRef(null);

  // The camera runs only while this page is showing the scan form: leaving the page unmounts
  // it (light off, battery saved), and so does a successful check-in.
  const cameraOn = mode === 'scan' && !isOpen && canCheckIn && open.isSuccess;
  useEffect(() => {
    if (!cameraOn) return undefined;
    let stop = () => {};
    let cancelled = false;
    setScanError('');
    startScanner(video.current, (text) => {
      const code = text.trim();
      if (!/^\d{6}$/.test(code)) {
        toast("That QR code isn't a GymFlow check-in code.", 'err');
        setTimeout(() => setScanKey((k) => k + 1), 1500);
        return;
      }
      // A wrong or expired code shouldn't strand the member on a dead video: resume scanning.
      checkin.mutate({ code, method: 'qr' }, { onError: () => setScanKey((k) => k + 1) });
    }, (e) => setScanError(e.message)).then((s) => { if (cancelled) s(); else stop = s; });
    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, scanKey]);

  if (!open.isSuccess || !me.data) return <div className="panel muted">Loading…</div>;

  return isOpen
    ? <CheckedIn open={open.data} me={me.data} today={today.data} custom={custom.data?.custom ?? []} onCheckout={() => checkout.mutate(open.data.id)} busy={checkout.isPending} />
    : (
      <div>
        {!canCheckIn && <div className="banner banner-expired">Your membership has expired. Renew at the front desk to check in.</div>}
        <div className="tab-row">
          <button type="button" className={`tab-btn${mode === 'scan' ? ' active' : ''}`} onClick={() => setMode('scan')}>📷 Scan QR</button>
          <button type="button" className={`tab-btn${mode === 'otp' ? ' active' : ''}`} onClick={() => setMode('otp')}>🔢 Enter Code</button>
        </div>
        {mode === 'scan' ? (
          <div className="panel">
            <p className="muted small">Point your camera at the code shown at the front desk.</p>
            <div className="scan-frame"><video ref={video} playsInline muted /><div className="scan-corners" /></div>
            <p className="checkin-scan-err">{scanError}</p>
          </div>
        ) : (
          <OtpEntry disabled={!canCheckIn || checkin.isPending} onSubmit={(code) => checkin.mutate({ code, method: 'otp' })} />
        )}
      </div>
    );
}

function OtpEntry({ disabled, onSubmit }) {
  const [digits, setDigits] = useState(Array(6).fill(''));
  const boxes = useRef([]);
  const code = digits.join('');

  const setAt = (i, v) => setDigits((d) => d.map((x, idx) => (idx === i ? v : x)));

  return (
    <div className="panel">
      <p className="muted small">Enter the 6-digit code shown at the front desk.</p>
      <div className="otp-boxes">
        {digits.map((d, i) => (
          <input
            key={i} ref={(el) => { boxes.current[i] = el; }} className="otp-box" inputMode="numeric" maxLength={1}
            value={d} disabled={disabled} aria-label={`Digit ${i + 1}`}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 1);
              setAt(i, v);
              if (v && boxes.current[i + 1]) boxes.current[i + 1].focus();
            }}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !d && boxes.current[i - 1]) boxes.current[i - 1].focus(); }}
            onPaste={(e) => {
              const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
              if (!pasted.length) return;
              e.preventDefault();
              setDigits(Array.from({ length: 6 }, (_, idx) => pasted[idx] ?? ''));
              boxes.current[Math.min(pasted.length, 5)]?.focus();
            }}
          />
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-block" disabled={disabled || code.length !== 6}
        onClick={() => { onSubmit(code); setDigits(Array(6).fill('')); boxes.current[0]?.focus(); }}>Check In</button>
    </div>
  );
}

function CheckedIn({ open, me, today, custom, onCheckout, busy }) {
  const saved = today?.exercises ?? [];
  const [picking, setPicking] = useState(false);
  const [sel, setSel] = useState(null); // null = untouched, so the form mirrors what's saved

  const chosen = sel ?? saved;
  const showSummary = saved.length > 0 && !picking;

  const rotation = exercisesFor(me.exercise_category).filter((x) => x !== 'Rest');
  const extras = [...new Set([...DEFAULT_EXERCISES, ...custom])].filter((x) => !rotation.includes(x));
  const toggle = (x, on) => setSel(on ? [...new Set([...chosen, x])] : chosen.filter((v) => v !== x));

  const save = useAction((exercises) => put('/attendance/me/today', { exercises }), {
    invalidate: ['my-today', 'my-attendance', 'attendance'],
    success: 'Marked present. Have a great workout! 💪',
  });

  const chip = (x) => (
    <label key={x} className={`ex-chk${chosen.includes(x) ? ' on' : ''}`}>
      <input type="checkbox" checked={chosen.includes(x)} onChange={(e) => toggle(x, e.target.checked)} />{x}
    </label>
  );

  return (
    <div className="panel checkin-active-card">
      <div className="checkin-active-icon">✅</div>
      <div className="checkin-active-ttl">You're checked in</div>
      <div className="checkin-active-sub">{open.at ? `Since ${fmtDateTime(open.at)}` : ''}</div>

      {showSummary ? (
        <div className="checkin-today">
          <div className="checkin-today-hdr">Today's Exercises</div>
          <div className="chip-row">{saved.map((x) => <span key={x} className="chip">{x}</span>)}</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSel(saved); setPicking(true); }}>Edit</button>
        </div>
      ) : (
        <div className="checkin-picker">
          <div className="checkin-today-hdr">What are you training today?</div>
          <div className="ex-grid">
            {rotation.map(chip)}
            {extras.length > 0 && <details className="ex-more"><summary>+ {extras.length} more</summary><div className="ex-grid">{extras.map(chip)}</div></details>}
          </div>
          <button type="button" className="btn btn-primary btn-block" disabled={!chosen.length || save.isPending}
            onClick={() => save.mutate(chosen, { onSuccess: () => { setPicking(false); setSel(null); } })}>Save &amp; Start Workout</button>
        </div>
      )}

      <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={onCheckout}>Check Out</button>
    </div>
  );
}
