import { useQuery } from '@tanstack/react-query';
import { del, post } from '../../api/client';
import { LIVE, queries, useAction } from '../../api/hooks';
import { fmtDateTime, membershipStatus } from '../../lib/format';

export default function MemberClasses() {
  const classes = useQuery({ ...queries.classes(), refetchInterval: LIVE });
  const me = useQuery(queries.me());
  const canBook = !!me.data && membershipStatus(me.data.expiry_date).key !== 'expired';

  const book = useAction((id) => post(`/classes/${id}/book`), { invalidate: ['classes'], success: 'Booked!' });
  const cancel = useAction((id) => del(`/classes/${id}/book`), { invalidate: ['classes'], success: 'Booking cancelled' });
  const list = classes.data ?? [];

  return (
    <>
      <div className="sec-title">Upcoming Classes</div>
      <div className="panel">
        <div className="panel-hdr"><div className="panel-ttl">📅 Book a Class</div><span className="panel-tag">Live</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Class</th><th>When</th><th>Seats Left</th><th /></tr></thead>
            <tbody>
              {!list.length && <tr className="empty"><td colSpan={4}>No upcoming classes yet.</td></tr>}
              {list.map((c) => {
                const left = c.capacity - c.booked_count;
                const tone = left <= 0 ? 'expired' : left <= 3 ? 'expiring' : 'active';
                return (
                  <tr key={c.id}>
                    <td data-label="Class"><strong>{c.title}</strong><span className="sub">{c.trainer}{c.tags.length ? ` · ${c.tags.join(', ')}` : ''}</span></td>
                    <td data-label="When">{fmtDateTime(c.start_at)}</td>
                    <td data-label="Seats Left"><span className={`status-badge status-${tone}`}>{left} / {c.capacity}</span></td>
                    <td className="row-actions">
                      {c.booked ? (
                        <>
                          <span className="status-badge status-active">✓ Booked</span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancel.mutate(c.id)}>Cancel</button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-primary btn-sm" disabled={!canBook || left <= 0 || book.isPending} onClick={() => book.mutate(c.id)}>{left <= 0 ? 'Full' : 'Book'}</button>
                      )}
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
