import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ChevronRight } from 'lucide-react';
import { fmtDate } from '@/lib/calibration';
import ReportStatusBadge from '@/components/common/ReportStatusBadge';
import ResultBadge from '@/components/common/ResultBadge';
import EmptyState from '@/components/common/EmptyState';

export default function EquipmentReports({ reports }) {
  return (
    <div className="panel p-6">
      <p className="eyebrow mb-4">Reports</p>
      {reports.length === 0 ? <EmptyState icon={FileText} title="No reports yet" /> : (
        <div className="divide-y -my-2">
          {reports.map((r) => (
            <Link key={r.id} to={`/reports/${r.id}`} className="flex items-center justify-between py-3 group">
              <div>
                <p className="font-mono text-[13px] font-medium text-slate-900 group-hover:text-primary transition-colors">{r.report_number}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(r.verification_date)} · {r.created_by_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <ResultBadge result={r.result} />
                <ReportStatusBadge status={r.status} />
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}