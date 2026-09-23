// CSV / Excel / PDF exports, ported from the old portal. SheetJS and jsPDF are
// loaded on first use so the portal's initial load stays light.
import { toast } from './toast.js';

const CDN = {
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/package/dist/xlsx.full.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',
};

const loaded = new Map();
function loadScript(src) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load the export library — check your connection.'));
      document.head.append(s);
    }));
  }
  return loaded.get(src);
}

const stamp = () => new Date().toISOString().slice(0, 10);

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** @param {{columns: string[], rows: (string|number)[][], name: string, title?: string}} data */
export function toCSV({ columns, rows, name }) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [columns, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  download(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), `${name}-${stamp()}.csv`);
}

export async function toExcel({ columns, rows, name }) {
  await loadScript(CDN.xlsx);
  const { utils, writeFile } = window.XLSX;
  const sheet = utils.aoa_to_sheet([columns, ...rows]);
  sheet['!cols'] = columns.map((c, i) => ({
    wch: Math.min(38, Math.max(c.length + 2, ...rows.map((r) => String(r[i] ?? '').length + 2))),
  }));
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, name.slice(0, 31));
  writeFile(book, `${name}-${stamp()}.xlsx`);
}

export async function toPDF({ columns, rows, name, title }) {
  await loadScript(CDN.jspdf);
  await loadScript(CDN.autotable);
  const doc = new window.jspdf.jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title || name, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()} · ${rows.length} rows`, 14, 22);
  doc.autoTable({
    head: [columns],
    body: rows,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [57, 229, 106], textColor: 20 },
    alternateRowStyles: { fillColor: [245, 247, 245] },
  });
  doc.save(`${name}-${stamp()}.pdf`);
}

const EXPORTERS = { csv: toCSV, excel: toExcel, pdf: toPDF };

/**
 * Wires an export dropdown. The container needs buttons with data-export="csv|excel|pdf";
 * `getData()` is called at click time so the current filter/sort is what gets exported.
 */
export function wireExportMenu(container, getData) {
  container.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-export]');
    if (!btn) return;
    const data = getData();
    if (!data.rows.length) return;
    btn.disabled = true;
    try {
      await EXPORTERS[btn.dataset.export](data);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      btn.disabled = false;
    }
  });
}

export const exportButtons = () => `
  <div class="export-row">
    <button class="btn btn-ghost btn-sm" data-export="csv">⬇ CSV</button>
    <button class="btn btn-ghost btn-sm" data-export="excel">⬇ Excel</button>
    <button class="btn btn-ghost btn-sm" data-export="pdf">⬇ PDF</button>
  </div>`;
