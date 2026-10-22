import React from 'react';
import { fmtDate } from '@/lib/calibration';
import ResultBadge from '@/components/common/ResultBadge';

export default function ReportContextCard({ snapshot: s, vr }) {
  const rows = [
    ['Equipment', s.equipment_name], ['Code', s.equipment_code], ['Serial No.', s.serial_number], ['Asset No.', s.asset_number],
    ['Manufacturer / Model', [s.manufacturer, s.model].filter(Boolean).join(' · ')], ['Location', `${s.department || ''} · ${s.location || ''}`],
    ['Previous Date', fmtDate(vr.previous_verification_date)], ['Verification Date', fmtDate(vr.verification_date)],
    ['Next Due Date', fmtDate(vr.next_due_date)], ['Verified By', vr.verified_by_name],
  ];
  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-4"><p className="eyebrow">Linked Verification</p><ResultBadge result={vr.result} /></div>
      <dl className="space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground text-xs">{k}</dt><dd className="text-right font-medium text-slate-800 text-[13px]">{v || '—'}</dd></div>
        ))}
      </dl>
    </div>
  );
}