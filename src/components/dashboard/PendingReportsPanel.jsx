import React from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';
import { fmtDate } from '@/lib/calibration';
import ReportStatusBadge from '@/components/common/ReportStatusBadge';
import EmptyState from '@/components/common/EmptyState';

export default function PendingReportsPanel({ equipment }) {
  const items = equipment.filter((e) => e.report_required).sort((a, b) => (b.latestVr.verification_date || '').localeCompare(a.latestVr.verification_date || ''));
  return (
    <div className="panel p-6 h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Pending Verification Reports <span className="ml-1 rounded-full bg-red-600 text-white px-1.5 py-0.5 text-xs">{items.length}</span></p>
        <Link to="/masterlist?report=pending" className="text-xs text-primary hover:underline">View all</Link>
      </div>
      {items.length === 0 ? <EmptyState icon={FileCheck2} title="All verifications have approved reports" /> : (
        <div className="divide-y">
          {items.slice(0, 7).map((e) => (
            <Link key={e.id} to={e.latestReport ? `/reports/${e.latestReport.id}` : `/reports/new?verification=${e.latestVr.id}`} className="flex items-center justify-between py-3 gap-3 group">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{e.equipment_name}</p>
                <p className="text-xs text-muted-foreground">Verified {fmtDate(e.latestVr.verification_date)} by {e.latestVr.verified_by_name}</p>
              </div>
              <ReportStatusBadge status={e.report_state} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}