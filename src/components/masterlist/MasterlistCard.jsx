import React from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/common/StatusBadge';
import ResultBadge from '@/components/common/ResultBadge';
import ReportStatusBadge from '@/components/common/ReportStatusBadge';
import DueCell from '@/components/masterlist/DueCell';
import { STATUS_META } from '@/lib/calibration';

export default function MasterlistCard({ e, isAdmin, onEdit, onDelete }) {
  return (
    <Link to={`/equipment/${e.id}`} className="block panel p-4 relative overflow-hidden active:scale-[0.99] transition-transform">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_META[e.status]?.dot}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-primary font-medium">{e.equipment_code}</p>
          <p className="font-medium text-slate-900 truncate">{e.equipment_name}</p>
          <p className="text-[11px] text-muted-foreground">{e.department} · {e.location}</p>
        </div>
        <StatusBadge status={e.status} />
      </div>
      <div className="flex items-end justify-between mt-3">
        <DueCell date={e.next_due} days={e.days_left} />
        <div className="flex items-center gap-1.5"><ResultBadge result={e.result} /><ReportStatusBadge status={e.report_state} /></div>
      </div>
      {isAdmin && (
        <div className="flex justify-end gap-1 mt-2 pt-2 border-t" onClick={(ev) => ev.preventDefault()}>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEdit(e)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => onDelete(e)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
        </div>
      )}
    </Link>
  );
}