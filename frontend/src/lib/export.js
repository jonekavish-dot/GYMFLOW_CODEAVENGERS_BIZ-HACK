// CSV / Excel / PDF exports. The spreadsheet and PDF libraries are imported on first use so
// they don't weigh down the initial load.
const stamp = () => new Date().toISOString().slice(0, 10);

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** data = { name, title?, columns: string[], rows: (string|number)[][] } */
export function toCSV({ columns, rows, name }) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [columns, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  download(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), `${name}-${stamp()}.csv`);
}

export async function toExcel({ columns, rows, name }) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const header = columns.map((value) => ({ value, fontWeight: 'bold' }));
  const body = rows.map((r) => r.map((v) => (typeof v === 'number' ? { value: v, type: Number } : { value: String(v ?? ''), type: String })));
  await writeExcelFile([header, ...body]).toFile(`${name}-${stamp()}.xlsx`);
}

export async function toPDF({ columns, rows, name, title }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title || name, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()} · ${rows.length} rows`, 14, 22);
  autoTable(doc, {
    head: [columns],
    body: rows.map((r) => r.map((v) => String(v ?? ''))),
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [57, 229, 106], textColor: 20 },
    alternateRowStyles: { fillColor: [245, 247, 245] },
  });
  doc.save(`${name}-${stamp()}.pdf`);
}

export const EXPORTERS = { csv: toCSV, excel: toExcel, pdf: toPDF };
