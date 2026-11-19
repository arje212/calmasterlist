import React from 'react';
import { fmtDate } from '@/lib/calibration';

export default function DueCell({ date, days }) {
  if (!date) return <span className="text-slate-400">—</span>;
  const tone = days < 0 ? 'text-red-600' : days <= 7 ? 'text-orange-600' : days <= 30 ? 'text-yellow-700' : 'text-muted-foreground';
  return (
    <div className="leading-tight">
      <p className="font-mono text-[12px] text-slate-800">{fmtDate(date)}</p>
      <p className={`text-xs ${tone}`}>{days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}</p>
    </div>
  );
}