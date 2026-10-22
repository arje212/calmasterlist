import React from 'react';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { ACTION_LABELS } from '@/lib/audit';

export default function AuditEntry({ log, showEntity = true }) {
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold text-slate-900">{log.user_name}</span>
          <span className={`ml-2 text-[10px] font-semibold tracking-wider rounded px-1.5 py-0.5 ${log.user_role === 'ADMIN' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{log.user_role}</span>
          <span className="text-muted-foreground"> · {ACTION_LABELS[log.action] || log.action}</span>
          {showEntity && log.entity_label && <span className="font-mono text-[12px] text-primary ml-1">{log.entity_label}</span>}
        </p>
        <p className="text-[11px] text-muted-foreground font-mono">{format(new Date(log.created_date), 'MMM d, yyyy · HH:mm')}</p>
      </div>
      {log.details && <p className="text-xs text-muted-foreground mt-1">{log.details}</p>}
      {log.changes?.length > 0 && (
        <div className="mt-2 space-y-1">
          {log.changes.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-[12px] bg-slate-50 rounded-md px-3 py-1.5">
              <span className="font-medium text-slate-700 min-w-[140px]">{c.field}</span>
              <span className="font-mono text-red-600/80 line-through decoration-red-300">{c.from || '∅'}</span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span className="font-mono text-emerald-700">{c.to || '∅'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}