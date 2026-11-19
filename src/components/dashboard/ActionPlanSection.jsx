// src/components/dashboard/ActionPlanSection.jsx
// Idagdag sa Dashboard.jsx. Hindi nito ginagalaw ang nasa taas ng dashboard.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';
import { Download, PencilLine } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Chip, Kpi, Stat, cn, money, pct } from '@/components/budget/ui';
import { MONTHS, PROJECTS, usePlan, computePlan, autoUnitsFromReports, planToCsv, downloadCsv } from '@/lib/budgetPlan';

// Galing sa 6. Reference sheet
const REFERENCE = {
  report: { steps: '7 → 6', cut: '−78.95%' },
  sticker: { steps: '5 → 3', cut: '−84.62%' },
  tape: 'Php27.00 clear, Php298.90 double-sided per roll',
};

const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== '' && typeof x !== 'object');

const FV_TABS = [
  { k: 'all', label: 'All' },
  { k: 'expired', label: 'Expired', tone: 'red' },
  { k: 'due_soon', label: 'Near expiration', tone: 'orange' },
  { k: 'near', label: 'For verify', tone: 'yellow' },
];
const FV_ORDER = { expired: 0, due_soon: 1, near: 2 };

function ForVerify({ equipment }) {
  const [tab, setTab] = useState('all');
  const base = useMemo(() => (equipment || []).filter((e) => e.status in FV_ORDER), [equipment]);
  const count = (k) => (k === 'all' ? base.length : base.filter((e) => e.status === k).length);
  const rows = useMemo(() => {
    const dueOf = (e) => pick(e.next_due_date, e.due_date, e.calibration_due_date, e.verification_due_date);
    return base
      .filter((e) => tab === 'all' || e.status === tab)
      .map((e) => ({ e, due: dueOf(e) }))
      .sort((a, b) => FV_ORDER[a.e.status] - FV_ORDER[b.e.status] || String(a.due || '').localeCompare(String(b.due || '')))
      .slice(0, 8);
  }, [base, tab]);
  const statusChip = { expired: ['red', 'Expired'], due_soon: ['orange', 'Near expiration'], near: ['yellow', 'For verify'] };

  return (
    <Card>
      <CardHeader title="For Verify Equipment" subtitle="Equipment that needs verification soon, most urgent first">
        <Button variant="outline" asChild><Link to={`/masterlist?status=${tab === 'all' ? 'near' : tab}`}>Open in Masterlist</Link></Button>
      </CardHeader>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {FV_TABS.map((t) => (
          <button key={t.k} aria-pressed={tab === t.k} onClick={() => setTab(t.k)}
            className={cn('flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold', tab === t.k ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white')}>
            {t.label}
            <span className={cn('rounded-full px-2 py-0.5 text-xs', tab === t.k ? 'bg-white/25 text-white' : 'bg-blue-50 text-primary')}>{count(t.k)}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[.08em] text-slate-600">
              <th className="px-3 py-2.5">Control no.</th><th className="px-3 py-2.5">Equipment</th><th className="px-3 py-2.5">Department</th><th className="px-3 py-2.5">Due date</th><th className="px-3 py-2.5">Days left</th><th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-600">Nothing to verify in this group.</td></tr>}
            {rows.map(({ e, due }) => {
              const d = due ? new Date(due) : null;
              const ok = d && !Number.isNaN(d.getTime());
              const left = ok ? differenceInDays(d, new Date()) : null;
              const [tone, label] = statusChip[e.status];
              return (
                <tr key={e.id} className="border-b border-slate-200">
                  <td className="px-3 py-3 font-bold">{pick(e.asset_id, e.control_number, e.control_no, e.id) || '—'}</td>
                  <td className="px-3 py-3 text-slate-600">{pick(e.equipment_name, e.name) || '—'}</td>
                  <td className="px-3 py-3 text-slate-600">{pick(e.department) || '—'}</td>
                  <td className="px-3 py-3 text-slate-600">{ok ? format(d, 'd MMM yyyy') : '—'}</td>
                  <td className={cn('px-3 py-3 tabular-nums', left != null && left < 0 && 'font-semibold text-red-700')}>{left == null ? '—' : left}</td>
                  <td className="px-3 py-3"><Chip tone={tone}>{label}</Chip></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function ActionPlanSection({ equipment = [], reports = [] }) {
  const { plan } = usePlan();
  const [cur, setCur] = useState('USD');
  const autoUnits = useMemo(() => (plan.useApp ? autoUnitsFromReports(reports, plan.year) : null), [reports, plan.year, plan.useApp]);
  const c = useMemo(() => computePlan(plan, autoUnits), [plan, autoUnits]);
  const t = c.total;
  const k = cur === 'PHP' ? plan.forex : 1; // conversion
  const m = (v, d = 2) => (v == null ? '—' : `${cur === 'PHP' ? '₱' : '$'}${money(v * k, d)}`);

  const cum = MONTHS.map((mo, i) => ({ m: mo, Budget: +(t.cumBudget[i] * k).toFixed(2), Actual: t.cumActual[i] == null ? null : +(t.cumActual[i] * k).toFixed(2) }));
  const bars = MONTHS.map((mo, i) => ({ m: mo, Budget: +(t.monthlyBudget[i] * k).toFixed(2), Actual: t.monthlyActual[i] == null ? null : +(t.monthlyActual[i] * k).toFixed(2) }));

  const now = new Date();
  const thisMonth = plan.year === now.getFullYear() ? now.getMonth() : -1;
  const unitsThisMonth = thisMonth >= 0 && autoUnits ? autoUnits[thisMonth] : 0;
  const unitsYear = autoUnits ? autoUnits.reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="mb-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.14em] text-slate-600">{plan.year} Action Plan</div>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">Savings Projects and Budget</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex overflow-hidden rounded-[10px] border border-slate-200" role="group" aria-label="Currency">
            {['USD', 'PHP'].map((x) => (
              <button key={x} aria-pressed={cur === x} onClick={() => setCur(x)} className={cn('min-h-[40px] px-4 text-[13px] font-semibold', cur === x ? 'bg-primary text-white' : 'bg-white')}>{x}</button>
            ))}
          </div>
          <Button variant="outline" className="gap-2" onClick={() => downloadCsv(`action-plan-${plan.year}.csv`, planToCsv(plan, c))}><Download className="h-4 w-4" />Export CSV</Button>
          <Button asChild className="gap-2 bg-primary hover:bg-primary/90"><Link to="/budget"><PencilLine className="h-4 w-4" />Encode budget</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Annual budget savings" value={m(t.budget)} hint="Report and sticker, Jan to Dec" />
        <Kpi label="Actual savings to date" value={m(t.actual)} hint={t.hasActual ? `${pct(t.ach)} of the annual budget` : 'Fills in from app activity'} dot="#10b981" />
        <Kpi label="Saved per report" value={m(c.perUnit.report)} hint="Direct labor" dot="#3b82f6" />
        <Kpi label="Saved per sticker" value={m(c.perUnit.sticker)} hint="Direct labor" dot="#f97316" />
      </div>

      <Card>
        <CardHeader title="Action Plan" subtitle={`Annual budget savings and actual savings per project (${cur})`} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[.08em] text-slate-600">
                <th className="px-3 py-2.5">Project</th><th className="px-3 py-2.5">Cycle time</th><th className="px-3 py-2.5 text-right">Budget</th><th className="px-3 py-2.5 text-right">Actual</th><th className="px-3 py-2.5">Achievement</th><th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(PROJECTS).map(({ key, name, sub }) => {
                const x = c.projects[key].totals;
                return (
                  <tr key={key} className="border-b border-slate-200">
                    <td className="px-3 py-3.5"><div className="font-bold">{name}</div><div className="mt-0.5 text-xs text-slate-600">{sub}</div></td>
                    <td className="px-3 py-3.5">{Math.round(x.avgBefore)} → {Math.round(x.avgAfter)} min/unit</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{m(x.budget)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{m(x.actual)}</td>
                    <td className="px-3 py-3.5"><div className="flex items-center gap-2"><span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><i className="block h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, (x.ach || 0) * 100))}%` }} /></span><b className="min-w-[44px] text-right">{pct(x.ach)}</b></div></td>
                    <td className="px-3 py-3.5">{x.actual == null ? <Chip tone="amber">Awaiting actual</Chip> : x.ach >= 0.9 ? <Chip tone="green">On plan</Chip> : x.ach >= 0.5 ? <Chip tone="amber">Behind plan</Chip> : <Chip tone="red">Behind plan</Chip>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Budgeting: cumulative savings" subtitle={`Budget for the year and actual so far (${cur})`}>
            {!t.hasActual && <Chip tone="amber">No actual yet</Chip>}
          </CardHeader>
          <div className="mt-3 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cum} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => `${cur} ${money(v)}`} />
                <Line type="monotone" dataKey="Budget" stroke="#1450d2" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="Actual" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly savings" subtitle={`Budget versus actual per month (${cur})`} />
          <div className="mt-3 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => `${cur} ${money(v)}`} />
                <Bar dataKey="Budget" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual" fill="#1450d2" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Reference" subtitle="Study item: replace the Excel-based calibration process with a Web-based system and a sticker printer">
            <Chip>From the Reference sheet</Chip>
          </CardHeader>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[['report', 'Report preparation'], ['sticker', 'Sticker preparation']].map(([key, title]) => {
              const x = c.projects[key].totals;
              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3.5 font-bold">{title}</div>
                  <div className="grid grid-cols-3 gap-3.5">
                    <Stat label="Steps" value={REFERENCE[key].steps} />
                    <Stat label="Cycle time" value={`${Math.round(x.avgBefore)} → ${Math.round(x.avgAfter)} min`} hint={REFERENCE[key].cut} />
                    <Stat label={`Saved per ${key}`} value={m(c.perUnit[key])} hint="Direct labor" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3.5 border-t border-slate-200 pt-4 md:grid-cols-4">
            <Stat label="Man cost" value={`Php${money(plan.manCost, 0)}/day`} hint={`USD ${money(c.rate)}/hr`} />
            <Stat label="Forex" value={`Php${money(plan.forex, 0)}`} hint="per USD" />
            <Stat label="Budget quantity" value={`${money(c.projects.report.totals.qty / 12, 0)} / month`} hint={`${money(c.projects.report.totals.qty, 0)} calibrations a year`} />
            <Stat label="Tape no longer bought" value="2 items" hint={REFERENCE.tape} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Auto-computed from the app" subtitle="Fills the actual savings of both projects"><Chip tone="green">{plan.useApp ? 'Auto' : 'Off'}</Chip></CardHeader>
          <div className="mt-4 flex flex-col gap-3.5 text-[13px]">
            {[['report', 'Calibration reports', 'Approved reports'], ['sticker', 'Calibration stickers', 'Stickers printed (one per approved report)']].map(([key, title, unit]) => (
              <div key={key} className="rounded-2xl border border-slate-200 p-4">
                <div className="font-bold">{title}</div>
                <div className="mt-1 text-slate-600">{unit} × {m(c.perUnit[key])}</div>
                <div className="mt-3 flex justify-between"><span>This month</span><b>{unitsThisMonth}</b></div>
                <div className="mt-1.5 flex justify-between"><span>This year</span><b>{unitsYear}</b></div>
                <div className="mt-1.5 flex justify-between"><span>Savings this year</span><b>{m(unitsYear * c.perUnit[key])}</b></div>
              </div>
            ))}
            <p className="text-xs leading-relaxed text-slate-600">Savings = units × minutes saved ÷ 60 × man cost per hour. The counts come from approved reports, so nobody has to type them in. You can override any month in Budget Entry.</p>
          </div>
        </Card>
      </div>

      <ForVerify equipment={equipment} />
    </div>
  );
}
