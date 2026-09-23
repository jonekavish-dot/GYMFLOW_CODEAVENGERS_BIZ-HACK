// Search + sort + pagination for the admin data tables, ported from the old portal's
// per-page copies of this logic. One controller drives one <tbody>.
import { $, $$, esc } from './dom.js';

/**
 * @param {object} o
 * @param {HTMLElement} o.el            module section (query root)
 * @param {string} o.body               selector for the <tbody>
 * @param {string} [o.search]           selector for a search <input>
 * @param {string} [o.pager]            selector for the pager container
 * @param {number} [o.pageSize]
 * @param {(row:any)=>string} o.render  one row → <tr> html
 * @param {(row:any)=>string} [o.match] haystack for the search box
 * @param {string} [o.sort]             initial sort field
 * @param {'asc'|'desc'} [o.dir]
 * @param {Record<string,(row:any)=>any>} [o.fields]  sort field → comparable value
 * @param {number} [o.cols]             colspan for the empty row
 * @param {string} [o.empty]            empty-state text
 */
export function dataTable({
  el, body, search, pager, pageSize = 10, render, match = (r) => JSON.stringify(r),
  sort = null, dir = 'asc', fields = {}, cols = 4, empty = 'Nothing to show yet.',
}) {
  let rows = [];
  let page = 1;
  let term = '';

  const bodyEl = $(body, el);
  const searchEl = search ? $(search, el) : null;
  const pagerEl = pager ? $(pager, el) : null;

  searchEl?.addEventListener('input', () => { term = searchEl.value.trim().toLowerCase(); page = 1; draw(); });

  // Sortable headers: <th data-sort="fieldName">
  const head = bodyEl.closest('table')?.tHead;
  $$('[data-sort]', head ?? el).forEach((th) => {
    th.classList.add('sortable');
    th.addEventListener('click', () => {
      const f = th.dataset.sort;
      dir = sort === f && dir === 'asc' ? 'desc' : 'asc';
      sort = f;
      page = 1;
      draw();
    });
  });

  function visible() {
    const found = term ? rows.filter((r) => match(r).toLowerCase().includes(term)) : rows.slice();
    const key = fields[sort];
    if (key) {
      const mul = dir === 'asc' ? 1 : -1;
      found.sort((a, b) => {
        const [x, y] = [key(a), key(b)];
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * mul;
        return String(x ?? '').localeCompare(String(y ?? '')) * mul;
      });
    }
    return found;
  }

  function draw() {
    const found = visible();
    const pages = Math.max(1, Math.ceil(found.length / pageSize));
    page = Math.min(page, pages);
    const slice = found.slice((page - 1) * pageSize, page * pageSize);

    bodyEl.innerHTML = slice.length
      ? slice.map(render).join('')
      : `<tr class="empty"><td colspan="${cols}">${esc(term ? `No matches for “${term}”.` : empty)}</td></tr>`;

    $$('[data-sort]', head ?? el).forEach((th) => {
      th.classList.toggle('sorted', th.dataset.sort === sort);
      th.dataset.dir = th.dataset.sort === sort ? dir : '';
    });

    if (!pagerEl) return;
    pagerEl.innerHTML = found.length
      ? `<span class="pg-info">${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, found.length)} of ${found.length}</span>
         <span class="pg-btns">
           <button class="btn btn-ghost btn-sm" data-pg="prev" ${page === 1 ? 'disabled' : ''}>‹</button>
           <span class="pg-cur">${page} / ${pages}</span>
           <button class="btn btn-ghost btn-sm" data-pg="next" ${page === pages ? 'disabled' : ''}>›</button>
         </span>`
      : '';
    $$('[data-pg]', pagerEl).forEach((b) => b.addEventListener('click', () => {
      page += b.dataset.pg === 'next' ? 1 : -1;
      draw();
    }));
  }

  return {
    /** Replace the dataset and redraw (safe to call from an onSnapshot callback). */
    set(next) { rows = next; draw(); },
    get rows() { return rows; },
    /** Current filter+sort result, ignoring pagination — used by the exporters. */
    get visible() { return visible(); },
    redraw: draw,
  };
}
