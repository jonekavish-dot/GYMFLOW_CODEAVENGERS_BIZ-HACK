import { EXPORTERS } from '../lib/export';
import { useToast } from './Toast';

/** getData() is called at click time, so the export reflects the current search and sort. */
export function ExportButtons({ getData }) {
  const toast = useToast();

  const run = async (kind) => {
    const data = getData();
    if (!data.rows.length) return toast('Nothing to export yet.', 'err');
    try { await EXPORTERS[kind](data); } catch (e) { toast(e.message || 'Export failed.', 'err'); }
  };

  return (
    <div className="export-row">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => run('csv')}>⬇ CSV</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => run('excel')}>⬇ Excel</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => run('pdf')}>⬇ PDF</button>
    </div>
  );
}
