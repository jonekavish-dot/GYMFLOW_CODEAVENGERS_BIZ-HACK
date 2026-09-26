import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patch, post } from '../../api/client';
import { queries, useAction } from '../../api/hooks';
import { fmtINR } from '../../lib/format';

const blank = () => ({ name: '', duration_days: 30, price: '', description: '' });

export default function Plans() {
  const plans = useQuery(queries.plans());
  const [form, setForm] = useState(blank);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = useAction((body) => post('/plans', body), { invalidate: ['plans'], success: 'Plan created' });
  const setActive = useAction(({ id, active }) => patch(`/plans/${id}`, { active }), { invalidate: ['plans'] });
  const list = plans.data ?? [];

  return (
    <div className="grid-2">
      <form className="panel" onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ name: form.name.trim(), duration_days: Number(form.duration_days), price: Number(form.price), description: form.description.trim() },
          { onSuccess: () => setForm(blank()) });
      }}>
        <div className="panel-hdr"><div className="panel-ttl">+ New Plan</div></div>
        <label>Name <input value={form.name} onChange={set('name')} required placeholder="Monthly" /></label>
        <div className="form-row">
          <label>Duration (days) <input type="number" min="1" value={form.duration_days} onChange={set('duration_days')} required /></label>
          <label>Price (₹) <input type="number" min="0" value={form.price} onChange={set('price')} required /></label>
        </div>
        <label>Description <input value={form.description} onChange={set('description')} /></label>
        <button type="submit" className="btn btn-primary btn-block" disabled={create.isPending}>Create Plan</button>
      </form>

      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">Plans</div></div>
        <ul className="list">
          {!list.length && <li className="muted">No plans yet. Members need a plan.</li>}
          {list.map((p) => (
            <li key={p.id}>
              <span className="plan-tag">{p.name}</span> <strong>{fmtINR(p.price)}</strong> <span className="muted">· {p.duration_days} days</span>
              {!p.active && <span className="status-badge status-muted">Inactive</span>}
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                onClick={() => setActive.mutate({ id: p.id, active: !p.active })}>{p.active ? 'Deactivate' : 'Activate'}</button>
              {p.description && <span className="muted small" style={{ flexBasis: '100%' }}>{p.description}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
