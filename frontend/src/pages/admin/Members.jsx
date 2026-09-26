import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { del, patch, post } from '../../api/client';
import { queries, useAction } from '../../api/hooks';
import { DataTable, SearchBox, useDataTable } from '../../components/DataTable';
import { ExportButtons } from '../../components/ExportButtons';
import { Modal, useConfirm } from '../../components/Modal';
import { CATEGORY_KEYS, DURATIONS, PAYMENT_METHODS, exercisesFor, monthlyRate } from '../../lib/exercises';
import { daysLeft, fmtDate, fmtINR, initials, membershipStatus, todayStr } from '../../lib/format';

const blank = () => ({
  custom_id: '', name: '', email: '', phone: '', password: '', plan_id: '', months: 1, start_date: todayStr(),
  exercise_category: 'A', paid: '', method: 'Cash', goals: '', notes: '',
});

const nextId = (members) => {
  const top = members.reduce((hi, m) => Math.max(hi, Number(String(m.custom_id).replace(/\D/g, '')) || 0), 0);
  return `ASF${String(top + 1).padStart(3, '0')}`;
};

export default function Members() {
  const confirm = useConfirm();
  const members = useQuery(queries.members());
  const plans = useQuery(queries.plans());
  const rows = members.data ?? [];
  const activePlans = (plans.data ?? []).filter((p) => p.active);

  const [form, setForm] = useState(blank);
  const [renewing, setRenewing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Default to the first active plan, and keep the fee in step with plan x duration (still editable for discounts).
  useEffect(() => {
    if (!form.plan_id && activePlans.length) setForm((f) => ({ ...f, plan_id: String(activePlans[0].id) }));
  }, [activePlans, form.plan_id]);
  useEffect(() => {
    const plan = activePlans.find((p) => String(p.id) === String(form.plan_id));
    if (plan) setForm((f) => ({ ...f, paid: monthlyRate(plan) * Number(f.months) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.plan_id, form.months, plans.data]);

  const register = useAction((body) => post('/members', body), {
    invalidate: ['members', 'payments'],
    success: 'Member registered. Share their email and temporary password.',
  });
  const remove = useAction((id) => del(`/members/${id}`), { invalidate: ['members', 'inside', 'attendance'], success: (_, id) => `Member ${id} removed` });

  const table = useDataTable({
    rows,
    match: (m) => [m.name, m.custom_id, m.phone, m.email, m.plan_name].join(' '),
    sort: 'expiry',
    fields: { name: (m) => m.name, plan: (m) => m.plan_name, cat: (m) => m.exercise_category, paid: (m) => m.paid, expiry: (m) => daysLeft(m.expiry_date) },
  });

  const submit = (e) => {
    e.preventDefault();
    register.mutate({
      ...form, plan_id: Number(form.plan_id), months: Number(form.months), paid: Number(form.paid) || 0,
      custom_id: form.custom_id.trim(),
    }, { onSuccess: () => setForm({ ...blank(), plan_id: form.plan_id }) });
  };

  const columns = [
    { label: 'Member', sort: 'name', render: (m) => (
      <div className="cell-user"><span className="av-sm">{initials(m.name)}</span>
        <span><strong>{m.name}</strong><span className="sub">{m.custom_id || m.email}</span></span></div>
    ) },
    { label: 'Plan', sort: 'plan', render: (m) => <span className="plan-tag">{m.plan_name}</span> },
    { label: 'Cat', sort: 'cat', render: (m) => <span className="cat-tag">{m.exercise_category || '–'}</span> },
    { label: 'Paid', sort: 'paid', render: (m) => fmtINR(m.paid) },
    { label: 'Expiry', sort: 'expiry', render: (m) => {
      const s = membershipStatus(m.expiry_date);
      return <>{fmtDate(m.expiry_date)}<span className="sub"><span className={`status-badge status-${s.key}`}>{s.label}</span></span></>;
    } },
    { label: 'Actions', actions: true, render: (m) => (
      <>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setRenewing(m)}>Renew</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewing(m)}>View</button>
        <button
          type="button" className="btn btn-danger btn-sm" aria-label={`Remove ${m.name}`}
          onClick={async () => {
            if (await confirm({ title: `Remove ${m.name}?`, confirmLabel: 'Remove member',
              message: 'Their membership and portal access are deleted. Payment history is kept for the revenue records.' })) remove.mutate(m.user_id);
          }}
        >✕</button>
      </>
    ) },
  ];

  const getExport = () => ({
    name: 'members', title: 'GymFlow — Members',
    columns: ['Member ID', 'Name', 'Email', 'Phone', 'Plan', 'Category', 'Joined', 'Expiry', 'Status', 'Paid', 'Renewals'],
    rows: table.visible.map((m) => [m.custom_id, m.name, m.email, m.phone, m.plan_name, m.exercise_category,
      fmtDate(m.start_date), fmtDate(m.expiry_date), membershipStatus(m.expiry_date).key, m.paid, m.renewal_count]),
  });

  return (
    <div className="grid-2">
      <form className="panel" onSubmit={submit}>
        <div className="panel-hdr"><div className="panel-ttl">+ Register Member</div></div>
        <div className="form-row">
          <label>Member ID <input value={form.custom_id} onChange={set('custom_id')} placeholder={`${nextId(rows)} (auto)`} /></label>
          <label>Full Name <input value={form.name} onChange={set('name')} required /></label>
        </div>
        <label>Email <input type="email" value={form.email} onChange={set('email')} required /></label>
        <div className="form-row">
          <label>Phone <input type="tel" value={form.phone} onChange={set('phone')} required /></label>
          <label>Temp Password <input value={form.password} onChange={set('password')} required minLength={8} placeholder="8+ characters" /></label>
        </div>
        <div className="form-row">
          <label>Plan <select value={form.plan_id} onChange={set('plan_id')} required>
            {activePlans.length ? activePlans.map((p) => <option key={p.id} value={p.id}>{p.name} · {fmtINR(monthlyRate(p))}/mo</option>) : <option value="">Create a plan first</option>}
          </select></label>
          <label>Duration <select value={form.months} onChange={set('months')}>
            {DURATIONS.map((d) => <option key={d.months} value={d.months}>{d.label} ({d.months}mo)</option>)}
          </select></label>
        </div>
        <div className="form-row">
          <label>Join Date <input type="date" value={form.start_date} onChange={set('start_date')} required /></label>
          <label>Exercise Category <select value={form.exercise_category} onChange={set('exercise_category')}>
            {CATEGORY_KEYS.map((k) => <option key={k} value={k}>Category {k}</option>)}
          </select></label>
        </div>
        <div className="form-row">
          <label>Fee Paid (₹) <input type="number" min="0" value={form.paid} onChange={set('paid')} required /></label>
          <label>Payment Method <select value={form.method} onChange={set('method')}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
        </div>
        <label>Goals <textarea rows={2} value={form.goals} onChange={set('goals')} placeholder="e.g. lose 5 kg, build stamina" /></label>
        <label>Notes <input value={form.notes} onChange={set('notes')} placeholder="Optional" /></label>
        <button type="submit" className="btn btn-primary btn-block" disabled={register.isPending || !activePlans.length}>
          {register.isPending ? 'Working…' : 'Register Member'}
        </button>
      </form>

      <div className="panel">
        <div className="panel-hdr">
          <div className="panel-ttl">All Members</div>
          <div className="hdr-tools"><SearchBox table={table} placeholder="Search name, ID, phone…" /><ExportButtons getData={getExport} /></div>
        </div>
        <DataTable table={table} columns={columns} rowKey={(m) => m.user_id} empty="No members yet. Register one on the left." />
      </div>

      {renewing && <RenewModal member={renewing} plans={activePlans} onClose={() => setRenewing(null)} />}
      {viewing && <DetailModal member={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function RenewModal({ member, plans, onClose }) {
  const [planId, setPlanId] = useState(String(member.plan_id ?? plans[0]?.id ?? ''));
  const [months, setMonths] = useState(1);
  const [fee, setFee] = useState('');
  const [method, setMethod] = useState(member.method || 'Cash');
  const plan = plans.find((p) => String(p.id) === planId);
  const expired = membershipStatus(member.expiry_date).key === 'expired';

  useEffect(() => { if (plan) setFee(monthlyRate(plan) * Number(months)); }, [plan, months]);

  const until = new Date(expired ? Date.now() : member.expiry_date);
  until.setMonth(until.getMonth() + Number(months));

  const renew = useAction((body) => post(`/members/${member.user_id}/renew`, body), {
    invalidate: ['members', 'payments'],
    success: (m) => `${member.name} renewed to ${fmtDate(m.expiry_date)} · ${fmtINR(fee)} collected`,
  });
  const s = membershipStatus(member.expiry_date);

  return (
    <Modal title={`Renew · ${member.name}`} onClose={onClose}>
      <div className="renew-who">
        <span className="av-sm">{initials(member.name)}</span>
        <div><strong>{member.name}</strong>
          <div className="muted small">{member.custom_id || member.email} · {member.plan_name} · <span className={`status-badge status-${s.key}`}>{s.label}</span></div>
          <div className="muted small">Paid so far: <strong>{fmtINR(member.paid)}</strong></div></div>
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        renew.mutate({ plan_id: Number(planId), months: Number(months), fee: Number(fee) || 0, method }, { onSuccess: onClose });
      }}>
        <label>Plan <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {fmtINR(monthlyRate(p))}/mo</option>)}
        </select></label>
        <label>Duration <select value={months} onChange={(e) => setMonths(e.target.value)}>
          {DURATIONS.map((d) => <option key={d.months} value={d.months}>{d.label} · {d.months} month{d.months > 1 ? 's' : ''}</option>)}
        </select></label>
        <div className="renew-preview">New expiry <strong>around {fmtDate(until)}</strong>
          <span className="muted"> · {expired ? 'restarts today (expired)' : 'stacks on remaining days'}</span></div>
        <div className="form-row">
          <label>Fee (₹) <input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} required /></label>
          <label>Method <select value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={renew.isPending || !plan}>Confirm Renewal</button>
      </form>
    </Modal>
  );
}

function DetailModal({ member, onClose }) {
  const [category, setCategory] = useState(member.exercise_category);
  const [password, setPassword] = useState('');
  const s = membershipStatus(member.expiry_date);

  const saveCategory = useAction((c) => patch(`/members/${member.user_id}`, { exercise_category: c }), { invalidate: ['members'], success: 'Exercise category updated' });
  const reset = useAction((pw) => post(`/members/${member.user_id}/reset-password`, { new_password: pw }), { success: 'Password reset. They are signed out everywhere.' });

  return (
    <Modal title={member.name} onClose={onClose} wide>
      <dl className="facts">
        <dt>Member ID</dt><dd>{member.custom_id || '–'}</dd>
        <dt>Status</dt><dd><span className={`status-badge status-${s.key}`}>{s.label}</span></dd>
        <dt>Plan</dt><dd>{member.plan_name}</dd>
        <dt>Joined</dt><dd>{fmtDate(member.start_date)}</dd>
        <dt>Expires</dt><dd>{fmtDate(member.expiry_date)}</dd>
        <dt>Phone</dt><dd>{member.phone || '–'}</dd>
        <dt>Email</dt><dd>{member.email}</dd>
        <dt>Total paid</dt><dd>{fmtINR(member.paid)}</dd>
        <dt>Renewals</dt><dd>{member.renewal_count}</dd>
        <dt>Goals</dt><dd>{member.goals || '–'}</dd>
        <dt>Notes</dt><dd>{member.notes || '–'}</dd>
      </dl>

      <div className="sec-title">Exercise Category</div>
      <form className="cat-editor" onSubmit={(e) => { e.preventDefault(); saveCategory.mutate(category); }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORY_KEYS.map((k) => <option key={k} value={k}>Category {k}</option>)}
        </select>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saveCategory.isPending}>Save</button>
      </form>
      <ul className="rotation">{exercisesFor(category).map((x) => <li key={x}>{x}</li>)}</ul>

      <div className="sec-title">Reset Password</div>
      <form className="cat-editor" onSubmit={(e) => { e.preventDefault(); reset.mutate(password, { onSuccess: () => setPassword('') }); }}>
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New temporary password (8+ characters)" minLength={8} required />
        <button type="submit" className="btn btn-ghost btn-sm" disabled={reset.isPending}>Reset</button>
      </form>
    </Modal>
  );
}
