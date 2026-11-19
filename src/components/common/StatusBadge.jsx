import React from 'react';
import { STATUS_META } from '@/lib/calibration';

export default function StatusBadge({ status, className = '' }) {
  const m = STATUS_META[status] || STATUS_META.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset whitespace-nowrap ${m.badge} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}