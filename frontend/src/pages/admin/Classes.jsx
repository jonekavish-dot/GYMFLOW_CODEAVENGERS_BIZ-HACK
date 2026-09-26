import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { del, post } from '../../api/client';
import { LIVE, queries, useAction } from '../../api/hooks';
import { useConfirm } from '../../components/Modal';
import { fmtDateTime, localInputToIso } from '../../lib/format';

const blank = () => ({ title: '', trainer: '', start_at: '', duration_min: 60, capacity: 20, tags: '' });

export default function Classes() {
  const confirm = useConfirm();
  const classes = useQuery({ ...queries.classes(), refetchInterval: LIVE });
  const [form, setForm] = useState(blank);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = useAction((body) => post('/classes', body), { invalidate: ['classes'], success: 'Class scheduled' });
  const remove = useAction((id) => del(`/classes/${id}`), { invalidate: ['classes'], success: 'Class deleted' });
  const list = classes.data ?? [];

  return (
    <div className="grid-2">
      <form className="panel" onSubmit={(e) => {
        e.preventDefault();
        create.mutate({
          title: form.title.trim(), trainer: form.trainer.trim(), start_at: localInputToIso(form.start_at),
          duration_min: Number(form.duration_min), capacity: Number(form.capacity),
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }, { onSuccess: () => setForm(blank()) });
      }}>
        <div className="panel-hdr"><div className="panel-ttl">+ Schedule Class</div></div>
        <label>Title <input value={form.title} onChange={set('title')} required placeholder="HIIT Blast" /></label>
        <label>Trainer <input value={form.trainer} onChange={set('trainer')} required /></label>
        <label>Starts <input type="datetime-local" value={form.start_at} onChange={set('start_at')} required /></label>
        <div className="form-row">
          <label>Duration (min) <input type="number" min="10" value={form.duration_min} onChange={set('duration_min')} required /></label>
          <label>Capacity <input type="number" min="1" value={form.capacity} onChange={set('capacity')} required /></label>
        </div>
        <label>Tags <input value={form.tags} onChange={set('tags')} placeholder="cardio, strength, beginner" /></label>
        <button type="submit" className="btn btn-primary btn-block" disabled={create.isPending}>Schedule Class</button>
      </form>

      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">Upcoming Classes</div><span className="panel-tag">Live</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Class</th><th>When</th><th>Booked</th><th /></tr></thead>
            <tbody>
              {!list.length && <tr className="empty"><td colSpan={4}>No upcoming classes.</td></tr>}
              {list.map((c) => (
                <tr key={c.id}>
                  <td data-label="Class"><strong>{c.title}</strong><span className="sub">{c.trainer}</span></td>
                  <td data-label="When">{fmtDateTime(c.start_at)}</td>
                  <td data-label="Booked"><span className={`status-badge status-${c.booked_count >= c.capacity ? 'expired' : 'active'}`}>{c.booked_count}/{c.capacity}</span></td>
                  <td className="row-actions">
                    <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (await confirm({ message: 'Delete this class?' })) remove.mutate(c.id); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
