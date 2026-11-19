import React, { useMemo, useState } from 'react';
import { addMonths, format } from 'date-fns';
import { Boxes, ShieldCheck, Timer, OctagonAlert, Hourglass, CalendarCheck, FileWarning, ChevronDown, Info } from 'lucide-react';
import { useCalibrationData, useMe, useIsAdmin } from '@/hooks/useCalData';
import { STATUS_META, RESULT_META, STATUSES, RESULTS, complianceFor, groupStats, monthlyTrend } from '@/lib/calibration';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import StatCard from '@/components/common/StatCard';
import DonutChart from '@/components/charts/DonutChart';
import TrendChart from '@/components/charts/TrendChart';
import ComplianceBars from '@/components/charts/ComplianceBars';
import ComplianceCard from '@/components/dashboard/ComplianceCard';
import UpcomingList from '@/components/dashboard/UpcomingList';
import PendingReportsPanel from '@/components/dashboard/PendingReportsPanel';
import AlertStrip from '@/components/dashboard/AlertStrip';
import ActionPlanSection from '@/components/dashboard/ActionPlanSection';

export default function Dashboard() {
  const { equipment, verifications, reports, settings, isLoading } = useCalibrationData();
  const { data: me } = useMe();
  const isAdmin = useIsAdmin();
  const [planOpen, setPlanOpen] = useState(false);
  const nextMonth = addMonths(new Date(), 1);
  const s = useMemo(() => {
    const count = (fn) => equipment.filter(fn).length;
    const month = format(new Date(), 'yyyy-MM');
    return {
      byStatus: Object.fromEntries(STATUSES.map((k) => [k, count((e) => e.status === k)])),
      byResult: Object.fromEntries(RESULTS.map((k) => [k, count((e) => e.result === k)])),
      verifiedMonth: verifications.filter((v) => (v.verification_date || '').startsWith(month)).length,
      pending: count((e) => e.report_required),
      compliance: complianceFor(equipment, verifications),
      depts: groupStats(equipment, verifications, 'department'),
      trend: monthlyTrend(verifications),
    };
  }, [equipment, verifications]);

  if (isLoading) return <LoadingState label="Loading dashboard…" />;
  return (
    <div>
      <PageHeader eyebrow={format(new Date(), 'EEEE, d MMMM yyyy')} title={`Welcome back${me?.full_name ? `, ${me.full_name.split(' ')[0]}` : ''}`} description="Live overview of calibration and verification status across the organization." />

      {/* 1. What needs attention right now */}
      <AlertStrip equipment={equipment} reports={reports} me={me} />

      {/* 2. Status at a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 fade-up">
        <StatCard label="Total Equipment" value={equipment.length} icon={Boxes} to="/masterlist" />
        <StatCard label="Done Verification" value={s.byStatus.valid} hint="Due after next month" icon={ShieldCheck} accent="bg-emerald-500" to="/masterlist?status=valid" />
        <StatCard label="For Verify" value={s.byStatus.near} hint={`Due ${format(nextMonth, 'MMMM yyyy')} — verify in advance`} icon={Timer} accent="bg-yellow-400" to="/masterlist?status=near" />
        <StatCard label="Expired" value={s.byStatus.expired} hint="Past due date" icon={OctagonAlert} accent="bg-red-500" to="/masterlist?status=expired" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-3 fade-up">
        <div className="lg:col-span-2"><ComplianceCard {...s.compliance} /></div>
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Near Expiration" value={s.byStatus.due_soon} hint={`Due within ${settings.due_soon_days} days or this month`} icon={Hourglass} accent="bg-orange-500" to="/masterlist?status=due_soon" />
          <StatCard label="Verifications This Month" value={s.verifiedMonth} icon={CalendarCheck} accent="bg-blue-500" to="/reports" />
          <StatCard label="Pending Reports" value={s.pending} hint="Report not yet approved" icon={FileWarning} accent="bg-red-600" to="/masterlist?report=pending" />
        </div>
      </div>
      <details className="mb-6 rounded-lg border bg-white px-4 py-3 text-sm group">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
          <Info className="h-4 w-4 text-primary" aria-hidden="true" />What do these statuses mean?
          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-muted-foreground sm:grid-cols-2">
          <div><dt className="inline font-semibold text-slate-800">{STATUS_META.valid.label}: </dt><dd className="inline">done verification.</dd></div>
          <div><dt className="inline font-semibold text-slate-800">{STATUS_META.near.label}: </dt><dd className="inline">due next month. Verification is done one month in advance.</dd></div>
          <div><dt className="inline font-semibold text-slate-800">{STATUS_META.due_soon.label}: </dt><dd className="inline">due within {settings.due_soon_days} days, or before the end of this month.</dd></div>
          <div><dt className="inline font-semibold text-slate-800">{STATUS_META.expired.label}: </dt><dd className="inline">already past the due date.</dd></div>
        </dl>
      </details>

      {/* 3. Lists to act on */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <UpcomingList equipment={equipment} />
        <PendingReportsPanel equipment={equipment} />
      </div>

      {/* 4. Overview charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <DonutChart title="Verification Results" centerLabel="Results" data={RESULTS.map((r) => ({ name: RESULT_META[r].label, value: s.byResult[r], color: RESULT_META[r].hex }))} />
        <DonutChart title="Expiration Status" centerLabel="Equipment" data={STATUSES.map((k) => ({ name: STATUS_META[k].label, value: s.byStatus[k], color: STATUS_META[k].hex }))} />
      </div>
      <div className="grid lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3"><TrendChart data={s.trend} /></div>
        <div className="lg:col-span-2"><ComplianceBars groups={s.depts} /></div>
      </div>

      {/* 5. Planning (admins see it by default; everyone else can expand it) */}
      {isAdmin || planOpen ? (
        <ActionPlanSection equipment={equipment} reports={reports} />
      ) : (
        <button type="button" onClick={() => setPlanOpen(true)} className="flex w-full items-center justify-between rounded-lg border bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Show savings projects and budget plan <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
