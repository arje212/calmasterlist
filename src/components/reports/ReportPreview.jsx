import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';

// Official view = the Excel template rendered to PDF by the server.  <iframe src> cannot send the Bearer token,
// so we fetch a blob and point the iframe at an object URL.
export default function ReportPreview({ report, onUnavailable }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;

  useEffect(() => {
    let live = true, objectUrl;
    setUrl(null); setError('');
    apiClient.reports.pdf(report.id)
      .then((blob) => { if (!live) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch((e) => {
        if (!live) return;
        if (/^No Excel template/i.test(e.message) && unavailable.current) unavailable.current();   // fall back to the basic layout
        else setError(e.message);
      });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [report.id, report.status, report.updated_date]);           // re-render after every save / status change

  const downloadXlsx = async () => {
    try {
      const blob = await apiClient.reports.xlsx(report.id);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${report.report_number}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e) { setError(e.message); }
  };
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;
  if (!url) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Generating report…</div>;
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadXlsx}><Download className="h-3.5 w-3.5" />Excel</Button>
      </div>
      <iframe title="Verification report" src={url} className="h-[85vh] w-full rounded-lg border bg-white" />
      {report.status !== 'approved' && <p className="text-[11px] text-muted-foreground">Preview — the official copy is saved when the report is approved.</p>}
    </div>
  );
}