import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { del, get, patch, post } from '../../api/client';
import { LIVE, queries, useAction } from '../../api/hooks';
import { Modal, useConfirm } from '../../components/Modal';
import { fmtDateTime, localInputToIso } from '../../lib/format';

const blank = () => ({ title: '', trainer: '', start_at: '', duration_min: 60, capacity: 15, status: 'open', notes: '' });
const endOf = (s) => new Date(s.end_at).getTime();

export default function Slots() {
  const confirm = useConfirm();
  const slots = useQuery({ ...queries.slots(), refetchInterval: LIVE });
  const trainers = useQuery(queries.trainers());
  const [form, setForm] = useState(blank);
  const [roster, setRoster] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const list = slots.data ?? [];

  // The server is the authority; this just warns before you submit.
  const start = form.start_at ? new Date(form.start_at).getTime() : null;
  const end = start ? start + (Number(form.duration_min) || 60) * 60000 : null;
  const clash = form.trainer && start
    ? list.find((s) => s.trainer === form.trainer && start < endOf(s) && end > new Date(s.start_at).getTime())
    : null;

  const create = useAction((body) => post('/slots', body), { invalidate: ['slots'], success: 'Workout slot created' });
  const toggle = useAction(({ id, status }) => patch(`/slots/${id}`, { status }), { invalidate: ['slots'], success: (s) => `Slot marked ${s.status}` });
  const remove = useAction((id) => del(`/slots/${id}`), { invalidate: ['slots'], success: 'Slot deleted' });

  const submit = (e) => {
    e.preventDefault();
    create.mutate({
      title: form.title.trim(), trainer: form.trainer, start_at: localInputToIso(form.start_at),
      duration_min: Number(form.duration_min), capacity: Number(form.capacity), status: form.status, notes: form.notes.trim(),
    }, { onSuccess: () => setForm(blank()) });
  };

  return (
    <div className="grid-2">
      <form className="panel" onSubmit={submit}>
        <div className="panel-hdr"><div className="panel-ttl">+ Create Gym Slot</div></div>
        <div className="form-row">
          <label>Slot Title / Area <input value={form.title} onChange={set('title')} required placeholder="e.g. Morning Workout (Floor A)" /></label>
          <label>Assign Trainer <select value={form.trainer} onChange={set('trainer')}>
            <option value="">No Trainer / Open Gym</option>
            {(trainers.data ?? []).map((t) => <option key={t.id} value={t.name}>{t.name} ({t.role || 'Trainer'})</option>)}
          </select></label>
        </div>
        <div className="form-row">
          <label>Starts At <input type="datetime-local" value={form.start_at} onChange={set('start_at')} required /></label>
          <label>Duration (mins) <input type="number" min="15" step="15" value={form.duration_min} onChange={set('duration_min')} required /></label>
        </div>
        <div className="form-row">
          <label>Max Customers (Capacity) <input type="number" min="1" value={form.capacity} onChange={set('capacity')} required /></label>
          <label>Initial Status <select value={form.status} onChange={set('status')}>
            <option value="open">Open for Booking</option><option value="closed">Closed / Reserved</option>
          </select></label>
        </div>
        {clash && (
          <div className="banner banner-expired" style={{ marginBottom: '0.75rem' }}>
            ⚠️ Trainer Conflict: {form.trainer} is already booked for "{clash.title}" ({fmtDateTime(clash.start_at)} – {fmtDateTime(clash.end_at)}). A new slot can only be scheduled after that slot completes.
          </div>
        )}
        <label>Notes / Restrictions <input value={form.notes} onChange={set('notes')} placeholder="e.g. Bring personal gym towel & water" /></label>
        <button type="submit" className="btn btn-primary btn-block" disabled={create.isPending}>⚡ Create Workout Slot</button>
      </form>

      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">Scheduled Gym Slots</div><span className="panel-tag">Live</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Slot</th><th>When</th><th>Booked</th><th>Status</th><th /></tr></thead>
            <tbody>
              {!list.length && <tr className="empty"><td colSpan={5}>No upcoming workout slots created yet.</td></tr>}
              {list.map((s) => {
                const full = s.booked_count >= s.capacity;
                const closed = s.status === 'closed';
                const tone = closed || full ? 'expired' : s.capacity - s.booked_count <= 3 ? 'expiring' : 'active';
                return (
                  <tr key={s.id}>
                    <td data-label="Slot"><strong>{s.title}</strong>
                      {s.trainer && <span className="sub">🧑‍🏫 {s.trainer}</span>}{s.notes && <span className="sub">{s.notes}</span>}</td>
                    <td data-label="When">{fmtDateTime(s.start_at)} <span className="sub">{s.duration_min} min</span></td>
                    <td data-label="Booked"><span className={`status-badge status-${tone}`}>{closed ? 'Closed' : full ? `FULL ${s.booked_count}/${s.capacity}` : `${s.booked_count} / ${s.capacity}`}</span></td>
                    <td data-label="Status">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle.mutate({ id: s.id, status: closed ? 'open' : 'closed' })}>{closed ? '🔴 Closed' : '🟢 Open'}</button>
                    </td>
                    <td className="row-actions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setRoster(s)}>👥 Roster</button>
                      <button type="button" className="btn btn-danger btn-sm" aria-label="Delete slot"
                        onClick={async () => { if (await confirm({ message: 'Delete this workout slot?' })) remove.mutate(s.id); }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {roster && <RosterModal slot={list.find((s) => s.id === roster.id) ?? roster} onClose={() => setRoster(null)} />}
    </div>
  );
}

function RosterModal({ slot, onClose }) {
  const confirm = useConfirm();
  const roster = useQuery({ queryKey: ['slots', slot.id, 'roster'], queryFn: () => get(`/slots/${slot.id}/roster`), refetchInterval: LIVE });
  const rows = roster.data ?? [];
  const remove = useAction((userId) => del(`/slots/${slot.id}/bookings/${userId}`), { invalidate: ['slots'], success: 'Removed from slot. Seat freed.' });
  const full = slot.booked_count >= slot.capacity;

  return (
    <Modal title={`Attendee Roster · ${slot.title}`} onClose={onClose} wide>
      <div className="panel-hdr">
        <div>
          <strong>{fmtDateTime(slot.start_at)}</strong>
          {slot.trainer && <div className="sub">🧑‍🏫 Trainer: <strong>{slot.trainer}</strong></div>}
          <div className="muted small">Max capacity: {slot.capacity} · Booked: {rows.length}</div>
        </div>
        <span className={`status-badge status-${full ? 'expired' : 'active'}`}>{full ? 'FULL' : `${slot.capacity - slot.booked_count} spots left`}</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Member</th><th>Member ID</th><th>Booked At</th><th /></tr></thead>
          <tbody>
            {!rows.length && <tr className="empty"><td colSpan={4}>{roster.isLoading ? 'Loading…' : 'No members have booked this slot yet.'}</td></tr>}
            {rows.map((b) => (
              <tr key={b.user_id}>
                <td data-label="Member"><strong>{b.member_name}</strong></td>
                <td data-label="Member ID"><span className="chip">{b.custom_id || '–'}</span></td>
                <td data-label="Booked At">{fmtDateTime(b.booked_at)}</td>
                <td className="row-actions">
                  <button type="button" className="btn btn-danger btn-sm"
                    onClick={async () => { if (await confirm({ title: 'Remove from slot?', confirmLabel: 'Remove', message: 'Remove this member from the slot and free their seat?' })) remove.mutate(b.user_id); }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
