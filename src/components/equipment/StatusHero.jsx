import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/useCalData';
import { STATUS_META, fmtDate } from '@/lib/calibration';
import { isExternalCalibration } from '@/lib/calibration';
import ResultBadge from '@/components/common/ResultBadge';
import ReportStatusBadge from '@/components/common/ReportStatusBadge';

function reportLink(e) {
  if (e.report_state === 'required') return { to: `/reports/new?verification=${e.latestVr.id}`, label: 'Create Report' };
  return { to: `/reports/${e.latestReport.id}`, label: 'Open Report' };
}

export default function StatusHero({ e }) {
  const { data: me } = useMe();
  const canCreateReport = me?.role === 'admin' || me?.role === 'user';
  const m = STATUS_META[e.status];
  const days = e.days_left;
  const external = isExternalCalibration(e);
  return (
    <div className="panel overflow-hidden">
      <div className={`${m.hero} px-6 py-6 text-white relative`}>
        <p className="text-xs uppercase tracking-[0.2em] opacity-80">Current Status</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="h-4 w-4 rounded-full bg-white/90 ring-4 ring-white/30 animate-pulse" />
          <p className="text-3xl font-semibold tracking-tight uppercase">{m.label}</p>
        </div>
        <p className="mt-2 text-sm opacity-90">
          {days === null ? 'No due date set' : days < 0 ? `Expired ${Math.abs(days)} days ago` : days === 0 ? 'Due today' : `${days} days until next ${e.calibration_type?.toLowerCase() || 'calibration'}`}
        </p>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-y border-t text-sm">
        <div className="p-4"><dt className="eyebrow">{external ? 'Last Calibrated' : 'Last Verified'}</dt><dd className="font-mono mt-1">{fmtDate(e.last_date)}</dd></div>
        <div className="p-4"><dt className="eyebrow">Next Due</dt><dd className="font-mono mt-1">{fmtDate(e.next_due)}</dd></div>
        <div className="p-4"><dt className="eyebrow">Result</dt><dd className="mt-1"><ResultBadge result={e.result} /></dd></div>
        <div className="p-4"><dt className="eyebrow">{external ? 'Certificate' : 'Report'}</dt><dd className="mt-1">{external ? e.certificate || 'Managed in External Calibration' : <ReportStatusBadge status={e.report_state} />}</dd></div>
      </dl>
      {e.report_required && !external && (
        <div className="border-t bg-red-50 px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">Report Required</p>
          </div>
          {canCreateReport && <Button size="sm" variant="outline" asChild className="border-red-200 text-red-700 hover:bg-red-100">
            <Link to={reportLink(e).to}>{reportLink(e).label}<ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>}
        </div>
      )}
    </div>
  );
}