import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { del, post, put } from '../../api/client';
import { queries, useAction } from '../../api/hooks';
import { Modal, useConfirm } from '../../components/Modal';
import { initials } from '../../lib/format';

const blank = () => ({ name: '', role: '', exp: 1, phone: '', title: '', skills: '', is_owner: false });
const toBody = (f) => ({
  name: f.name.trim(), role: f.role.trim(), exp: Number(f.exp) || 0, phone: f.phone.trim(), title: f.title.trim(),
  skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean), is_owner: f.is_owner,
});

function TrainerFields({ form, set }) {
  return (
    <>
      <label>Name <input value={form.name} onChange={set('name')} required /></label>
      <label>Speciality <input value={form.role} onChange={set('role')} required placeholder="Strength & Conditioning" /></label>
      <div className="form-row">
        <label>Experience (yrs) <input type="number" min="0" value={form.exp} onChange={set('exp')} /></label>
        <label>Phone <input type="tel" value={form.phone} onChange={set('phone')} /></label>
      </div>
      <label>Title <input value={form.title} onChange={set('title')} placeholder="e.g. Mr. Tamil Nadu" /></label>
      <label>Skills <input value={form.skills} onChange={set('skills')} placeholder="Comma separated" /></label>
      <label className="check-line"><input type="checkbox" checked={form.is_owner} onChange={(e) => set('is_owner')({ target: { value: e.target.checked } })} /> Gym owner</label>
    </>
  );
}

export default function Trainers() {
  const confirm = useConfirm();
  const trainers = useQuery(queries.trainers());
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = useAction((body) => post('/trainers', body), { invalidate: ['trainers'], success: 'Trainer added' });
  const remove = useAction((id) => del(`/trainers/${id}`), { invalidate: ['trainers', 'attendance'], success: 'Trainer removed' });
  const list = trainers.data ?? [];

  return (
    <div className="grid-2">
      <form className="panel" onSubmit={(e) => { e.preventDefault(); create.mutate(toBody(form), { onSuccess: () => setForm(blank()) }); }}>
        <div className="panel-hdr"><div className="panel-ttl">+ Add Trainer</div></div>
        <TrainerFields form={form} set={set} />
        <button type="submit" className="btn btn-primary btn-block" disabled={create.isPending}>Add Trainer</button>
      </form>

      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">Team</div></div>
        <div className="trainer-grid">
          {!list.length && <p className="muted">No trainers yet.</p>}
          {list.map((t) => (
            <div key={t.id} className="trainer-card">
              <div className="tc-top"><span className="av-sm">{initials(t.name)}</span>
                <div><strong>{t.name}</strong><div className="muted small">{t.role}{t.exp ? ` · ${t.exp} yr${t.exp > 1 ? 's' : ''}` : ''}</div></div>
                {t.is_owner && <span className="status-badge status-active">Owner</span>}</div>
              {t.title && <div className="tc-title">🥇 {t.title}</div>}
              {t.skills.length > 0 && <div className="chip-row">{t.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
              {t.phone && <div className="muted small">📞 {t.phone}</div>}
              <div className="row-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(t)}>Edit</button>
                <button type="button" className="btn btn-danger btn-sm"
                  onClick={async () => { if (await confirm({ title: `Remove ${t.name}?`, confirmLabel: 'Remove trainer', message: 'They disappear from the roster and attendance roll call.' })) remove.mutate(t.id); }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && <EditTrainer trainer={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditTrainer({ trainer, onClose }) {
  const [form, setForm] = useState({ ...trainer, skills: trainer.skills.join(', ') });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = useAction((body) => put(`/trainers/${trainer.id}`, body), { invalidate: ['trainers'], success: 'Trainer updated' });

  return (
    <Modal title={`Edit · ${trainer.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(toBody(form), { onSuccess: onClose }); }}>
        <TrainerFields form={form} set={set} />
        <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending}>Save</button>
      </form>
    </Modal>
  );
}
