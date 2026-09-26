import { useEffect, useMemo, useState } from 'react';

/**
 * Search + sort + pagination state for a table.
 *   match(row) -> string searched by the box; fields { key: row => comparable } powers sortable headers.
 * `visible` is the full filtered+sorted list, ignoring pagination, so exports match what's on screen.
 */
export function useDataTable({ rows, match = (r) => JSON.stringify(r), fields = {}, sort = null, dir = 'asc', pageSize = 10 }) {
  const [term, setTerm] = useState('');
  const [sortKey, setSortKey] = useState(sort);
  const [sortDir, setSortDir] = useState(dir);
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const found = needle ? rows.filter((r) => match(r).toLowerCase().includes(needle)) : rows.slice();
    const value = fields[sortKey];
    if (value) {
      const mul = sortDir === 'asc' ? 1 : -1;
      found.sort((a, b) => {
        const [x, y] = [value(a), value(b)];
        return typeof x === 'number' && typeof y === 'number' ? (x - y) * mul : String(x ?? '').localeCompare(String(y ?? '')) * mul;
      });
    }
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, term, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pages);
  useEffect(() => { setPage(1); }, [term]);

  return {
    term, setTerm, sortKey, sortDir, visible, pages, page: current, setPage, pageSize,
    slice: visible.slice((current - 1) * pageSize, current * pageSize),
    toggleSort(key) {
      setSortDir(sortKey === key && sortDir === 'asc' ? 'desc' : 'asc');
      setSortKey(key);
      setPage(1);
    },
  };
}

export function SearchBox({ table, placeholder }) {
  return (
    <input className="search-input" type="search" placeholder={placeholder} value={table.term} onChange={(e) => table.setTerm(e.target.value)} />
  );
}

/**
 * columns: [{ label, sort?: fieldKey, render(row), actions?: true }]
 * Each cell carries data-label so the mobile stylesheet can turn rows into labelled cards.
 */
export function DataTable({ table, columns, empty = 'Nothing to show yet.', rowKey = (r) => r.id, pager = true }) {
  const { slice, visible, page, pages, pageSize } = table;
  const colSpan = columns.length;

  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c, i) => {
                const sortable = !!c.sort;
                const active = sortable && table.sortKey === c.sort;
                return (
                  <th
                    key={i}
                    className={`${sortable ? 'sortable' : ''}${active ? ' sorted' : ''}`}
                    data-dir={active ? table.sortDir : ''}
                    onClick={sortable ? () => table.toggleSort(c.sort) : undefined}
                  >{c.label}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.length ? slice.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c, i) => (
                  <td key={i} className={c.actions ? 'row-actions' : undefined} data-label={c.actions ? undefined : c.label}>{c.render(row)}</td>
                ))}
              </tr>
            )) : (
              <tr className="empty"><td colSpan={colSpan}>{table.term ? `No matches for “${table.term}”.` : empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pager && visible.length > 0 && (
        <div className="pager">
          <span className="pg-info">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visible.length)} of {visible.length}</span>
          <span className="pg-btns">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => table.setPage(page - 1)}>‹</button>
            <span className="pg-cur">{page} / {pages}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => table.setPage(page + 1)}>›</button>
          </span>
        </div>
      )}
    </>
  );
}
