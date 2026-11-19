import React from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/common/StatusBadge';
import ResultBadge from '@/components/common/ResultBadge';
import ReportStatusBadge from '@/components/common/ReportStatusBadge';
import DueCell from '@/components/masterlist/DueCell';
import { STATUS_META } from '@/lib/calibration';

// The card itself is a link; the admin buttons sit outside it (a button inside a link is invalid and easy to mis-tap).
export default function MasterlistCard({ e, isAdmin, onEdit, onDelete }) {
  return (
    <div className="panel relative overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_META[e.status]?.dot}`} aria-hidden="true" />
      <Link to={`/equipment/${e.id}`} className="block p-4 active:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-primary font-medium">{e.equipment_code}</p>
            <p className="font-medium text-slate-900 truncate">{e.equipment_name}</p>
            <p className="text-xs text-muted-foreground">{e.department} · {e.location}</p>
          </div>
          <StatusBadge status={e.status} />
        </div>
        <div className="flex items-end justify-between mt-3">
          <DueCell date={e.next_due} days={e.days_left} />
          <div className="flex items-center gap-1.5"><ResultBadge result={e.result} /><ReportStatusBadge status={e.report_state} /></div>
        </div>
      </Link>
      {isAdmin && (
        <div className="flex justify-end gap-3 border-t px-3 py-2">
          <Button variant="ghost" size="sm" className="h-10 px-4 text-sm" onClick={() => onEdit(e)} aria-label={`Edit ${e.equipment_code}`}><Pencil className="h-4 w-4 mr-1.5" />Edit</Button>
          <Button variant="ghost" size="sm" className="h-10 px-4 text-sm text-red-600" onClick={() => onDelete(e)} aria-label={`Delete ${e.equipment_code}`}><Trash2 className="h-4 w-4 mr-1.5" />Delete</Button>
        </div>
      )}
    </div>
  );
}
