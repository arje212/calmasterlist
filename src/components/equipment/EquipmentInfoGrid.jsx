import React from 'react';
import { fmtDate } from '@/lib/calibration';

export default function EquipmentInfoGrid({ e }) {
  const rows = [
    ['Control Number', e.equipment_code, true], ['Equipment Type', e.category], ['Maker', e.manufacturer],
    ['Model', e.model], ['Serial Number', e.serial_number, true], ['Asset Number', e.asset_number, true],
    ['Location', e.location], ['Department', e.department], ['Responsible Person', e.responsible_person],
    ['Verification', e.calibration_type], ['Frequency', `${e.frequency_months || 12} months`], ['Certificate / Report No.', e.certificate, true],
    ['Created By', `${e.created_by_name || '—'} · ${fmtDate(e.created_date)}`], ['Updated By', `${e.updated_by_name || '—'} · ${fmtDate(e.updated_date)}`],
  ];
  return (
    <div className="panel p-6">
      <p className="eyebrow mb-4">Equipment Information</p>
      <dl className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
        {rows.map(([k, v, mono]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className={`text-sm text-slate-900 mt-0.5 break-words ${mono ? 'font-mono' : ''}`}>{v || '—'}</dd>
          </div>
        ))}
      </dl>
      {(e.description || e.remarks) && (
        <div className="grid sm:grid-cols-2 gap-6 mt-5 pt-5 border-t">
          <div><p className="text-xs text-muted-foreground">Range</p><p className="text-sm mt-0.5">{e.description || '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Remarks</p><p className="text-sm mt-0.5">{e.remarks || '—'}</p></div>
        </div>
      )}
    </div>
  );
}