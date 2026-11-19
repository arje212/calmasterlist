import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { REPORT_STATUS_META } from '@/lib/calibration';

export default function ReportStatusBadge({ status }) {
  const m = REPORT_STATUS_META[status] || REPORT_STATUS_META.none;
  if (status === 'none' || !status) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset whitespace-nowrap ${m.badge}`}>
      {status === 'required' && <AlertTriangle className="h-3 w-3" />}
      {m.label}
    </span>
  );
}