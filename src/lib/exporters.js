const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// columns: [{ key, label }], rows: array of plain objects
export function downloadCSV(filename, columns, rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => q(c.label)).join(','), ...rows.map((r) => columns.map((c) => q(r[c.key])).join(','))];
  download('\ufeff' + lines.join('\n'), `${filename}.csv`, 'text/csv;charset=utf-8');
}

function tableHtml(columns, rows) {
  return `<table><thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${columns.map((c) => `<td>${esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function downloadExcel(filename, columns, rows) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body>${tableHtml(columns, rows)}</body></html>`;
  download(html, `${filename}.xls`, 'application/vnd.ms-excel');
}

export function printTable(title, columns, rows, subtitle = '') {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>${esc(title)}</title><style>
    body{font-family:'IBM Plex Sans',Arial,sans-serif;color:#0f172a;padding:24px}
    h1{font-size:18px;margin:0 0 4px} p{color:#64748b;font-size:11px;margin:0 0 16px}
    table{border-collapse:collapse;width:100%;font-size:10px} th{background:#1e40af;color:#fff;text-align:left}
    th,td{border:1px solid #cbd5e1;padding:5px 6px} tr:nth-child(even) td{background:#f8fafc}
  </style></head><body><h1>${esc(title)}</h1><p>${esc(subtitle)} · Generated ${new Date().toLocaleString()} · ${rows.length} records</p>${tableHtml(columns, rows)}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}