import { useQuery } from '@tanstack/react-query';
import { post } from '../../api/client';
import { LIVE, queries, useAction } from '../../api/hooks';
import { fmtDateTime, membershipStatus } from '../../lib/format';

const SlotCell = ({ s }) => (
  <>
    <strong>{s.title}</strong>
    {s.trainer && <span className="sub">🧑‍🏫 Trainer: {s.trainer}</span>}
    {s.notes && <span className="sub">{s.notes}</span>}
  </>
);

export default function MemberSlots() {
  const slots = useQuery({ ...queries.slots(), refetchInterval: LIVE });
  const me = useQuery(queries.me());
  const canBook = !!me.data && membershipStatus(me.data.expiry_date).key !== 'expired';

  // Once booked, a seat is confirmed: members can't cancel (the front desk can free it).
  const book = useAction((id) => post(`/slots/${id}/book`), { invalidate: ['slots'], success: 'Slot booked! 🎉' });

  const list = slots.data ?? [];
  const mine = list.filter((s) => s.booked);
  const available = list.filter((s) => !s.booked && s.status !== 'closed' && s.booked_count < s.capacity);

  return (
    <>
      <div className="sec-title">Book a Gym Slot</div>
      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">🎟️ My Booked Slots</div><span className="panel-tag">{mine.length}</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Slot</th><th>When</th><th>Status</th></tr></thead>
            <tbody>
              {!mine.length && <tr className="empty"><td colSpan={3}>You have no upcoming workout slots booked.</td></tr>}
              {mine.map((s) => (
                <tr key={s.id}>
                  <td data-label="Slot"><SlotCell s={s} /></td>
                  <td data-label="When">{fmtDateTime(s.start_at)} <span className="sub">{s.duration_min} min</span></td>
                  <td data-label="Status"><span className="status-badge status-active">✓ Booked</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">⚡ Available Workout Slots</div><span className="panel-tag">Live</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Slot</th><th>When</th><th>Spots Left</th><th /></tr></thead>
            <tbody>
              {!available.length && <tr className="empty"><td colSpan={4}>{slots.isLoading ? 'Loading available slots…' : 'No open slots available right now.'}</td></tr>}
              {available.map((s) => {
                const left = s.capacity - s.booked_count;
                return (
                  <tr key={s.id}>
                    <td data-label="Slot"><SlotCell s={s} /></td>
                    <td data-label="When">{fmtDateTime(s.start_at)} <span className="sub">{s.duration_min} min</span></td>
                    <td data-label="Spots Left"><span className={`status-badge status-${left <= 3 ? 'expiring' : 'active'}`}>{left} / {s.capacity}</span></td>
                    <td className="row-actions">
                      <button type="button" className="btn btn-primary btn-sm" disabled={!canBook || book.isPending} onClick={() => book.mutate(s.id)}>{canBook ? 'Book' : 'Expired'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
