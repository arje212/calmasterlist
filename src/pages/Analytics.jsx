import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import { useCalibrationData, useIsAdmin } from '@/hooks/useCalData';
import { RESULTS, RESULT_META, STATUS_META, groupStats, fmtDate } from '@/lib/calibration';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import ProblemAreas from '@/components/analytics/ProblemAreas';
import ExportCenter from '@/components/analytics/ExportCenter';
import { Card, CardHeader, Chip, cn } from '@/components/budget/ui';

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const locKey = (s) => norm(s).toLowerCase().replace(/[\s-]+/g, '');
const STATUS_ORDER = ['expired', 'due_soon', 'near', 'valid', 'unknown'];
const LATER = '#cbd5e1'; // lavender for months further out

// Same place spelled differently ("PROD - LS ASSY" / "PROD - LS Assy" / "PROD-LS ASSY") becomes one location.
function mergeLocations(list) {
  const spellings = {};
  list.forEach((e) => {
    const k = locKey(e.location);
    if (!k) return;
    const m = (spellings[k] ||= {});
    m[norm(e.location)] = (m[norm(e.location)] || 0) + 1;
  });
  const label = Object.fromEntries(Object.entries(spellings).map(([k, m]) => [k, Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]]));
  return list.map((e) => ({ ...e, location: label[locKey(e.location)] || e.location }));
}

const countBy = (list, fn) => {
  const m = {};
  list.forEach((e) => { const k = fn(e); if (k) m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

function buildAnalytics(equipment, now = new Date()) {
  const byStatus = Object.fromEntries(STATUS_ORDER.map((k) => [k, equipment.filter((e) => e.status === k).length]));

  const results = RESULTS.map((r) => ({ r, n: equipment.filter((e) => e.result === r).length }));
  const resultTotal = results.reduce((s, x) => s + x.n, 0);
  const noResult = equipment.length - resultTotal;

  const checkingTypes = countBy(equipment, (e) => norm(e.calibration_type));
  const equipmentTypes = countBy(equipment, (e) => norm(e.equipment_name));

  const thisMonth = startOfMonth(now);
  const monthKey = (e, field) => String(e[field] || '').slice(0, 7);
  const overdue = equipment.filter((e) => e.next_due && e.next_due < format(thisMonth, 'yyyy-MM-dd')).length;
  const schedule = Array.from({ length: 12 }, (_, i) => {
    const m = addMonths(thisMonth, i);
    const key = format(m, 'yyyy-MM');
    return { key, label: format(m, 'MMM'), value: equipment.filter((e) => monthKey(e, 'next_due') === key).length, color: i === 0 ? STATUS_META.due_soon.hex : i === 1 ? STATUS_META.near.hex : LATER };
  });
  const activity = Array.from({ length: 12 }, (_, i) => {
    const m = subMonths(thisMonth, 11 - i);
    const key = format(m, 'yyyy-MM');
    return { key, label: format(m, 'MMM'), value: equipment.filter((e) => monthKey(e, 'last_date') === key).length, color: i === 11 ? '#93c5fd' : '#1450d2' };
  });

  const merged = mergeLocations(equipment);
  const locations = Object.entries(merged.reduce((acc, e) => {
    const k = e.location || 'Unassigned';
    const g = (acc[k] ||= { name: k, total: 0, expired: 0, due_soon: 0, near: 0 });
    g.total += 1;
    if (e.status in g) g[e.status] += 1;
    return acc;
  }, {})).map(([, g]) => g).sort((a, b) => b.total - a.total);

  const attention = equipment.filter((e) => e.status === 'expired' || e.status === 'due_soon').sort((a, b) => String(a.next_due).localeCompare(String(b.next_due)));

  return { byStatus, results, resultTotal, noResult, checkingTypes, equipmentTypes, schedule, overdue, activity, activityTotal: activity.reduce((s, x) => s + x.value, 0), locations, attention, merged };
}

// ───────────── Mga piraso ng UI ─────────────

function Legend({ items }) {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
      {items.map(([color, label]) => (
        <span key={label}><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-[-1px]" style={{ background: color }} />{label}</span>
      ))}
    </div>
  );
}

function Columns({ items, height = 150 }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="mt-4">
      <div className="flex items-end gap-1.5 border-b border-slate-200" style={{ height }}>
        {items.map((i) => (
          <div key={i.key} className="flex h-full flex-1 flex-col items-center justify-end" title={`${i.label}: ${i.value}`}>
            <span className="mb-1 text-xs font-semibold tabular-nums text-slate-600">{i.value}</span>
            <div className="w-full max-w-[30px] rounded-t-md" style={{ height: Math.max(3, Math.round((i.value / max) * (height - 22))), background: i.color }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {items.map((i) => <span key={i.key} className="flex-1 text-center text-xs text-slate-600">{i.label}</span>)}
      </div>
    </div>
  );
}

function HBars({ rows, color, labelWidth = 150 }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className="mt-4 space-y-3">
      {rows.map(([label, n]) => (
        <div key={label} className="flex items-center gap-3 text-[13px]">
          <span className="truncate" style={{ width: labelWidth }} title={label}>{label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.round((n / max) * 100)}%`, background: color }} /></div>
          <span className="w-9 text-right font-bold tabular-nums">{n}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ items, total }) {
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg width="170" height="170" viewBox="0 0 170 170" role="img" aria-label={`${total} equipment with results`} className="flex-none">
      <g transform="rotate(-90 85 85)" fill="none" strokeWidth="24">
        <circle cx="85" cy="85" r={R} stroke="#e2e8f0" />
        {total > 0 && items.filter((i) => i.value > 0).map((i) => {
          const len = (i.value / total) * C;
          const el = <circle key={i.key} cx="85" cy="85" r={R} stroke={i.color} strokeDasharray={`${len} ${C}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </g>
      <text x="85" y="84" textAnchor="middle" fontSize="26" fontWeight="800" fill="#0f172a">{total}</text>
      <text x="85" y="104" textAnchor="middle" fontSize="12" fill="#475569">With results</text>
    </svg>
  );
}

export default function Analytics() {
  const { equipment, verifications, reports, settings, isLoading } = useCalibrationData();
  const isAdmin = useIsAdmin();
  const [showAllLocations, setShowAllLocations] = useState(false);
  const a = useMemo(() => buildAnalytics(equipment), [equipment]);
  const depts = useMemo(() => groupStats(equipment, verifications, 'department'), [equipment, verifications]);
  const locs = useMemo(() => groupStats(a.merged, verifications, 'location'), [a.merged, verifications]);

  if (isLoading) return <LoadingState label="Calculating analytics…" />;

  const now = new Date();
  const nextMonth = addMonths(now, 1);
  const total = equipment.length || 1;
  const tiles = {
    expired: 'Past due date',
    due_soon: 'This month or within ' + (settings?.due_soon_days ?? 7) + ' days',
    near: `Due ${format(nextMonth, 'MMMM')}`,
    valid: `Due after ${format(nextMonth, 'MMMM')}`,
    unknown: 'Reference only or no date',
  };
  const visibleLocations = showAllLocations ? a.locations : a.locations.slice(0, 8);
  const link = 'min-h-[44px] inline-flex items-center text-[13px] font-semibold text-primary hover:underline';

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Insights" title="Analytics" description="All figures are calculated live from the masterlist." />

      {/* Equipment status */}
      <Card className="fade-up">
        <CardHeader title="Equipment status" subtitle="Where every piece of equipment stands today"><Chip>{equipment.length} total</Chip></CardHeader>
        <div className="my-5 flex h-4 gap-0.5 overflow-hidden rounded-full">
          {STATUS_ORDER.filter((k) => a.byStatus[k] > 0).map((k) => (
            <div key={k} className="min-w-[3px]" style={{ width: `${(a.byStatus[k] / total) * 100}%`, background: STATUS_META[k].hex }} title={`${STATUS_META[k].label}: ${a.byStatus[k]}`} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
          {STATUS_ORDER.map((k) => (
            <Link key={k} to={`/masterlist?status=${k}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-primary">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STATUS_META[k].hex }} />{STATUS_META[k].label}</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight">{a.byStatus[k]}</p>
              <p className="mt-0.5 text-xs text-slate-600">{tiles[k]}</p>
              <p className="mt-2 text-xs text-slate-600">{((a.byStatus[k] / total) * 100).toFixed(1)}% of all equipment</p>
            </Link>
          ))}
        </div>
      </Card>

      {/* Results + checking type */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Latest result per equipment" subtitle={`${a.resultTotal} with results`} />
          <div className="mt-4 flex flex-wrap items-center gap-7">
            <Donut total={a.resultTotal} items={a.results.map(({ r, n }) => ({ key: r, value: n, color: RESULT_META[r].hex }))} />
            <div className="flex min-w-[200px] flex-1 flex-col gap-3">
              {a.results.map(({ r, n }) => (
                <div key={r} className="flex items-center gap-2.5 text-[13px]">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: RESULT_META[r].hex }} />
                  <span>{RESULT_META[r].label[0] + RESULT_META[r].label.slice(1).toLowerCase()}</span>
                  <b className="ml-auto tabular-nums">{n}</b>
                  <span className="w-11 text-right tabular-nums text-slate-600">{a.resultTotal ? Math.round((n / a.resultTotal) * 100) : 0}%</span>
                </div>
              ))}
              <div className="mt-1 flex items-center gap-2.5 border-t border-slate-200 pt-3 text-[13px] text-slate-600">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-slate-300" />No result (reference only)
                <b className="ml-auto tabular-nums text-slate-900">{a.noResult}</b>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Checking type" subtitle="How equipment is checked" />
          <HBars rows={a.checkingTypes} color="#1450d2" labelWidth={140} />
        </Card>
      </div>

      {/* Schedule + activity */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Due schedule" subtitle="Next 12 months">
            {a.overdue > 0 && <Chip tone="red">{a.overdue} already overdue</Chip>}
          </CardHeader>
          <Columns items={a.schedule} />
          <Legend items={[[STATUS_META.due_soon.hex, 'This month'], [STATUS_META.near.hex, 'Verify now'], [LATER, 'Later']]} />
        </Card>
        <Card>
          <CardHeader title="Verification activity" subtitle={`By checking date · ${a.activityTotal} in the last 12 months`}>
            <Chip>Light bar: this month so far</Chip>
          </CardHeader>
          <Columns items={a.activity} />
        </Card>
      </div>

      {/* Needs attention */}
      <Card>
        <CardHeader title={`Needs attention · ${a.attention.length}`} subtitle="Expired or about to expire, most urgent first">
          <Link to="/masterlist?status=due_soon" className={link}>View in masterlist</Link>
        </CardHeader>
        {a.attention.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Nothing is expired or about to expire.</p>
        ) : (
          <div className="mt-3">
            {a.attention.slice(0, 10).map((e) => {
              const expired = e.status === 'expired';
              return (
                <Link key={e.id} to={`/equipment/${e.id}`} className="group flex items-center gap-3.5 border-b border-slate-200 px-1 py-3.5 last:border-0">
                  <span className={cn('h-[38px] w-[38px] flex-none rounded-xl', expired ? 'bg-red-100' : 'bg-orange-100')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold transition-colors group-hover:text-primary">{e.equipment_name}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-600">{e.equipment_code}</p>
                  </div>
                  <span className="text-xs text-slate-600">{fmtDate(e.next_due, 'dd MMM')}</span>
                  <span className={cn('min-w-[84px] rounded-lg px-2.5 py-1 text-center text-xs font-semibold', expired ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800')}>
                    {expired ? `${Math.abs(e.days_left)} d overdue` : `${e.days_left} days`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Type + location */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="By equipment type" subtitle="Top 8" />
          <HBars rows={a.equipmentTypes.slice(0, 8)} color="#1450d2" labelWidth={150} />
        </Card>
        <Card>
          <CardHeader title="By location" subtitle={`${a.locations.length} locations, same spellings merged`} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[380px] text-[13px]">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[.08em] text-slate-600">
                  <th className="pb-2">Location</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Expired</th><th className="pb-2 text-right">Near exp.</th><th className="pb-2 text-right">For verify</th>
                </tr>
              </thead>
              <tbody>
                {visibleLocations.map((g) => (
                  <tr key={g.name} className="border-t border-slate-200">
                    <td className="py-2.5 pr-2">{g.name}</td>
                    <td className="text-right tabular-nums">{g.total}</td>
                    <td className={cn('text-right tabular-nums', g.expired ? 'font-bold text-red-700' : 'text-slate-600')}>{g.expired}</td>
                    <td className={cn('text-right tabular-nums', g.due_soon ? 'font-bold text-orange-700' : 'text-slate-600')}>{g.due_soon}</td>
                    <td className={cn('text-right tabular-nums', g.near ? 'font-bold' : 'text-slate-600')}>{g.near}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {a.locations.length > 8 && (
            <button type="button" className={cn(link, 'mt-2')} onClick={() => setShowAllLocations((v) => !v)}>
              {showAllLocations ? 'Show top 8 only' : `Show all ${a.locations.length} locations`}
            </button>
          )}
        </Card>
      </div>

      <div>
        <p className="mb-3.5 mt-1 text-xs font-semibold uppercase tracking-[.14em] text-slate-600">Top problem areas</p>
        <ProblemAreas depts={depts} locations={locs} />
      </div>
      {isAdmin && <ExportCenter equipment={equipment} verifications={verifications} reports={reports} />}
    </div>
  );
}