import React from 'react';
import { RESULT_META } from '@/lib/calibration';

export default function ResultBadge({ result }) {
  const m = RESULT_META[result];
  if (!m) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono font-semibold tracking-wide ring-1 ring-inset ${m.badge}`}>
      {m.label}
    </span>
  );
}