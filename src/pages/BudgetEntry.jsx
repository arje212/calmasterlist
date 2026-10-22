// src/pages/BudgetEntry.jsx
// Dito ine-encode ang budget ng 2027 Action Plan (report at sticker projects).
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Eraser, RotateCcw, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { useCalibrationData } from '@/hooks/useCalData';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardHeader, Chip, Kpi, cn, money, pct } from '@/components/budget/ui';
import {
  MONTHS, PROJECTS, usePlan, computePlan, autoUnitsFromReports, planToCsv,
  defaultPlan, blankPlan, setCellIn, setQtyIn,
} from '@/lib/budgetPlan';

// Mga linya ng grid ng bawat proyekto. kind: 'in' = input, 'calc' = formula
const ROWS = [
  { sec: 'Time study' },
  { kind: 'in', k: 'before', label: 'Cycle time before', unit: 'min/unit' },
  { kind: 'in', k: 'after', label: 'Cycle time after', unit: 'min/unit' },
  { sec: 'Materials (USD per month)' },
  { kind: 'in', k: 'matB', label: 'Materials before', unit: 'USD' },
  { kind: 'in', k: 'matA', label: 'Materials after', unit: 'USD' },
  { sec: 'Budget' },
  { kind: 'calc', k: 'laborB', label: 'Labor cost before', unit: 'USD' },
  { kind: 'calc', k: 'laborA', label: 'Labor cost after', unit: 'USD' },
  { kind: 'calc', k: 'costB', label: 'Total cost before', unit: 'USD' },
  { kind: 'calc', k: 'costA', label: 'Total cost after', unit: 'USD' },
  { kind: 'calc', k: 'budget', label: 'Budget savings', unit: 'USD', strong: true },
  { kind: 'calc', k: 'ytd', label: 'Year to date budget', unit: 'USD' },
  { sec: 'Actual (fill in when available)' },
  { kind: 'in', k: 'act', label: 'Actual cost after', unit: 'USD' },
  { kind: 'calc', k: 'actSav', label: 'Actual savings', unit: 'USD', strong: true },
  { kind: 'calc', k: 'ach', label: 'Achievement rate', unit: '%' },
];

const inputCls = 'rounded-md border bg-[#faf8ff] px-2 py-1.5 text-right text-[13px] tabular-nums text-[#1b1740] focus:outline-none focus:ring-2 focus:ring-[#7c5cfc]';

function Cell({ value, onChange, bad, warn, label, title, step = 'any', className }) {
  return (
    <input
      type="number" min="0" step={step} inputMode="decimal" aria-label={label} title={title}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={cn(inputCls, 'w-full min-w-[68px]', bad ? 'border-red-500 bg-red-50' : warn ? 'border-amber-500 bg-amber-50' : 'border-[#e7e3f7]', className)}
    />
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#5b5675]">
      {label}
      {children}
    </label>
  );
}

// Dalawang click bago gumana (para hindi aksidenteng mabura ang data)
function ConfirmButton({ icon: Icon, label, onConfirm }) {
  const [armed, setArmed] = useState(false);
  const click = () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false); onConfirm();
  };
  return (
    <Button variant="outline" className="gap-2" onClick={click}>
      <Icon className="h-4 w-4" />
      {armed ? 'Click again to confirm' : label}
    </Button>
  );
}

function ProjectGrid({ pk, plan, c, setPlan }) {
  const P = PROJECTS[pk];
  const data = c.projects[pk];
  const fmtCell = (k, v) => (k === 'ach' ? pct(v) : money(v));
  const totalOf = (k) => {
    if (k === 'before') return data.totals.avgBefore;
    if (k === 'after') return data.totals.avgAfter;
    if (k === 'matB' || k === 'matA') return plan[pk][k].reduce((a, b) => a + (Number(b) || 0), 0);
    if (k === 'act') { const v = plan[pk].act.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + Number(b), 0) : null; }
    if (k === 'ytd') return data.totals.budget;
    if (k === 'actSav') return data.totals.actual;
    if (k === 'ach') return data.totals.ach;
    return data.totals[k];
  };

  return (
    <Card>
      <CardHeader title={P.name} subtitle={`${P.sub}. Quantity comes from the monthly quantity above.`} />
      <div className="mt-4 overflow-x-auto rounded-xl border border-[#e7e3f7]">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-[13px]" aria-label={`${P.name} monthly budget`}>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[210px] border-b border-r border-[#e7e3f7] bg-[#f1ecff] px-3 py-2.5 text-left text-[11px] uppercase tracking-[.08em] text-[#5b5675]">Line</th>
              {MONTHS.map((m) => <th key={m} className="border-b border-[#e7e3f7] bg-[#f1ecff] px-1.5 py-2.5 text-right text-[11px] uppercase tracking-[.08em] text-[#5b5675]">{m}</th>)}
              <th className="min-w-[92px] border-b border-l border-[#e7e3f7] bg-[#f1ecff] px-2 py-2.5 text-right text-[11px] uppercase tracking-[.08em] text-[#5b5675]">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="sticky left-0 z-10 border-b border-r border-[#e7e3f7] bg-white px-3 py-2 text-left font-semibold">Quantity <small className="font-medium text-[#5b5675]">calibrations</small></th>
              {data.months.map((m, i) => <td key={i} className="border-b border-[#e7e3f7] bg-[#f7f5fd] px-2 py-2 text-right tabular-nums">{money(m.qty, 0)}</td>)}
              <td className="border-b border-l border-[#e7e3f7] bg-[#f7f5fd] px-2 py-2 text-right font-bold tabular-nums">{money(data.totals.qty, 0)}</td>
            </tr>
            {ROWS.map((r, idx) => {
              if (r.sec) return <tr key={idx}><th colSpan={14} className="bg-[#f1ecff] px-3 py-2 text-left text-[11px] uppercase tracking-[.1em] text-[#5b5675]">{r.sec}</th></tr>;
              return (
                <tr key={r.k}>
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-[#e7e3f7] bg-white px-3 py-1.5 text-left font-semibold">{r.label} <small className="font-medium text-[#5b5675]">{r.unit}</small></th>
                  {data.months.map((m, i) => {
                    if (r.kind === 'in') {
                      const v = plan[pk][r.k][i];
                      const bad = v != null && v < 0;
                      const warn = r.k === 'after' && v > plan[pk].before[i];
                      return (
                        <td key={i} className="border-b border-[#e7e3f7] px-1 py-1">
                          <Cell
                            value={v} bad={bad} warn={warn && !bad}
                            label={`${P.short} ${r.label}, ${MONTHS[i]}`}
                            title={bad ? 'Value cannot be negative' : warn ? 'Cycle time after is longer than before' : undefined}
                            onChange={(val) => setPlan((p) => setCellIn(p, pk, r.k, i, r.k === 'act' ? val : val ?? 0))}
                          />
                        </td>
                      );
                    }
                    const v = m[r.k];
                    return <td key={i} className={cn('border-b border-[#e7e3f7] bg-[#f7f5fd] px-2 py-1.5 text-right tabular-nums', r.strong && 'font-extrabold', v != null && v < 0 && 'text-red-700')}>{m.auto && r.k === 'actSav' ? <span title="Counted from approved reports in the app">{fmtCell(r.k, v)}*</span> : fmtCell(r.k, v)}</td>;
                  })}
                  <td className={cn('border-b border-l border-[#e7e3f7] bg-[#f7f5fd] px-2 py-1.5 text-right font-bold tabular-nums', r.strong && 'font-extrabold')}>{fmtCell(r.k, totalOf(r.k))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[#5b5675]">An asterisk (*) means the actual was counted from approved reports in the app. Type a value in “Actual cost after” to override it.</p>
    </Card>
  );
}

function buildChecks(plan, c) {
  const out = [];
  const add = (tone, text) => out.push({ tone, text });
  if (!(plan.manCost > 0 && plan.hours > 0 && plan.forex > 0)) add('red', 'Man cost, working hours and forex must all be greater than zero.');
  const zero = plan.qty.map((q, i) => (q > 0 ? null : MONTHS[i])).filter(Boolean);
  if (zero.length) add('amber', `No quantity entered for ${zero.join(', ')}.`);
  Object.values(PROJECTS).forEach(({ key, short }) => {
    const longer = MONTHS.filter((_, i) => plan[key].after[i] > plan[key].before[i]);
    const neg = MONTHS.filter((_, i) => c.projects[key].months[i].budget < 0);
    const n = c.projects[key].months.filter((m) => m.actSav != null).length;
    if (longer.length) add('amber', `${short}: cycle time after is longer than before in ${longer.join(', ')}.`);
    if (neg.length) add('amber', `${short}: budget savings are negative in ${neg.join(', ')} (after costs exceed before costs).`);
    add(n ? 'green' : 'amber', n ? `${short}: actual available for ${n} of 12 months.` : `${short}: no actual yet. Achievement stays blank until one is entered or counted from the app.`);
  });
  if (out.every((x) => x.tone === 'green')) out.push({ tone: 'green', text: 'All checks passed.' });
  return out;
}

function Summary({ plan, c }) {
  const t = c.total;
  const chart = MONTHS.map((m, i) => ({ m, Budget: Number(t.monthlyBudget[i].toFixed(2)), Actual: t.monthlyActual[i] == null ? null : Number(t.monthlyActual[i].toFixed(2)) }));
  const checks = buildChecks(plan, c);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Annual budget savings" value={`USD ${money(t.budget)}`} hint="Both projects, Jan to Dec" />
        <Kpi label="Actual savings to date" value={t.hasActual ? `USD ${money(t.actual)}` : '—'} hint={t.hasActual ? 'Months with actual' : 'Awaiting actual'} dot="#10b981" />
        <Kpi label="Achievement rate" value={t.hasActual ? pct(t.ach) : '—'} hint="Actual ÷ annual budget" dot="#f97316" />
        <Kpi label="Saved per report" value={`USD ${money(c.perUnit.report)}`} hint="Labor only" dot="#3b82f6" />
        <Kpi label="Saved per sticker" value={`USD ${money(c.perUnit.sticker)}`} hint="Labor only" dot="#ec4899" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Projects" subtitle="Annual totals from the two project tabs." />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-[#e7e3f7] text-[11px] uppercase tracking-[.08em] text-[#5b5675]"><th className="py-2 text-left">Project</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Budget</th><th className="py-2 text-right">Actual</th><th className="py-2 text-right">Achievement</th></tr></thead>
              <tbody>
                {Object.values(PROJECTS).map(({ key, name, sub }) => {
                  const x = c.projects[key].totals;
                  return (
                    <tr key={key} className="border-b border-[#f1eefb] tabular-nums">
                      <td className="py-3 text-left"><div className="font-bold">{name}</div><div className="text-xs text-[#5b5675]">{sub}</div></td>
                      <td className="py-3 text-right">{money(x.qty, 0)}</td>
                      <td className="py-3 text-right">{money(x.budget)}</td>
                      <td className="py-3 text-right">{money(x.actual)}</td>
                      <td className="py-3 text-right">
                        <span className="mr-2 inline-block h-2 w-20 overflow-hidden rounded-full bg-[#ece8fb] align-middle"><i className="block h-full bg-[#7c5cfc]" style={{ width: `${Math.max(0, Math.min(100, (x.ach || 0) * 100))}%` }} /></span>
                        {pct(x.ach)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly savings" subtitle="Budget and actual, both projects (USD)" />
          <div className="mt-3 h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#ece8fb" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#5b5675' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#5b5675' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => `USD ${money(v)}`} />
                <Bar dataKey="Budget" fill="#d9d0fb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual" fill="#7c5cfc" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="Checks" subtitle="Review these before you rely on the numbers." />
        <ul className="mt-3 flex flex-col gap-2 text-[13px]">
          {checks.map((x, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <Chip tone={x.tone}>{x.tone === 'green' ? 'OK' : x.tone === 'red' ? 'Fix' : 'Check'}</Chip>
              <span>{x.text}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function BudgetEntry() {
  const navigate = useNavigate();
  const { reports } = useCalibrationData();
  const { plan, setPlan, savedAt } = usePlan();
  const [tab, setTab] = useState('summary');
  const [note, setNote] = useState('');

  const autoUnits = useMemo(() => (plan.useApp ? autoUnitsFromReports(reports, plan.year) : null), [reports, plan.year, plan.useApp]);
  const c = useMemo(() => computePlan(plan, autoUnits), [plan, autoUnits]);
  const set = (k) => (e) => setPlan((p) => ({ ...p, [k]: e.target.value === '' ? 0 : Number(e.target.value) }));

  const copyCsv = async () => {
    const text = planToCsv(plan, c);
    try { await navigator.clipboard.writeText(text); setNote('CSV copied to the clipboard'); }
    catch { setNote('Copy was blocked by the browser'); }
    setTimeout(() => setNote(''), 3000);
  };

  const tabs = [['summary', 'Summary'], ['report', 'Calibration report'], ['sticker', 'Calibration sticker']];

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate(-1)}><ArrowLeft className="h-3.5 w-3.5" />Back</Button>
      <PageHeader eyebrow={`${plan.year} Action Plan`} title="Budget Entry" description="Encode the savings budget for the calibration report and sticker projects. Shaded cells are formulas; everything else you can type.">
        <span role="status" aria-live="polite" className="mr-1 flex items-center gap-1.5 text-xs text-[#5b5675]">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {note || (savedAt ? `Saved at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saves automatically')}
        </span>
        <Button variant="outline" className="gap-2" onClick={copyCsv}><Copy className="h-4 w-4" />Copy as CSV</Button>
        <ConfirmButton icon={RotateCcw} label="Load reference values" onConfirm={() => setPlan(defaultPlan())} />
        <ConfirmButton icon={Eraser} label="Clear all" onConfirm={() => setPlan(blankPlan())} />
      </PageHeader>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Cost basis" subtitle="Applies to both projects. Direct labor only; indirect labor is excluded." />
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Field label="Plan year"><input type="number" className={cn(inputCls, 'border-[#e7e3f7] text-left text-[15px] font-semibold')} value={plan.year} onChange={set('year')} /></Field>
            <Field label="Man cost (PHP per day)"><input type="number" min="0" step="any" className={cn(inputCls, 'border-[#e7e3f7] text-left text-[15px] font-semibold')} value={plan.manCost} onChange={set('manCost')} /></Field>
            <Field label="Working hours per day"><input type="number" min="0" step="any" className={cn(inputCls, 'border-[#e7e3f7] text-left text-[15px] font-semibold')} value={plan.hours} onChange={set('hours')} /></Field>
            <Field label="Forex (PHP per USD)"><input type="number" min="0" step="any" className={cn(inputCls, 'border-[#e7e3f7] text-left text-[15px] font-semibold')} value={plan.forex} onChange={set('forex')} /></Field>
            <Field label="Man cost (USD per hour)"><div className="min-h-[38px] rounded-md border border-dashed border-[#e7e3f7] bg-[#f7f5fd] px-2.5 py-2 text-[15px] font-bold normal-case tracking-normal text-[#1b1740]">USD {money(c.rate, 4)}</div></Field>
          </div>
          <h4 className="mt-6 text-[15px] font-bold">Monthly quantity (in-house calibrations)</h4>
          <p className="mt-1 text-[13px] text-[#5b5675]">Expected number of calibrations each month. Shared by the report and sticker projects.</p>
          <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:grid-cols-12">
            {MONTHS.map((m, i) => (
              <label key={m} className="flex flex-col gap-1 text-[11px] font-semibold text-[#5b5675]">
                {m}
                <Cell value={plan.qty[i]} step="1" label={`Quantity, ${m}`} bad={plan.qty[i] < 0} onChange={(v) => setPlan((p) => setQtyIn(p, i, v ?? 0))} />
              </label>
            ))}
          </div>
          <label className="mt-5 flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={!!plan.useApp} onChange={(e) => setPlan((p) => ({ ...p, useApp: e.target.checked }))} className="h-4 w-4 accent-[#7c5cfc]" />
            Count approved reports in this app as actual savings (one report and one sticker each)
          </label>
        </Card>

        <div role="tablist" aria-label="Budget sections" className="flex flex-wrap gap-2">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn('min-h-[44px] rounded-full border px-5 text-[13px] font-semibold transition-colors', tab === k ? 'border-[#7c5cfc] bg-[#7c5cfc] text-white' : 'border-[#e7e3f7] bg-white hover:border-[#7c5cfc]')}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'summary' && <Summary plan={plan} c={c} />}
        {tab === 'report' && <ProjectGrid pk="report" plan={plan} c={c} setPlan={setPlan} />}
        {tab === 'sticker' && <ProjectGrid pk="sticker" plan={plan} c={c} setPlan={setPlan} />}

        <p className="text-xs text-[#5b5675]">Amounts are in USD. Savings = (labor + materials before) − (labor + materials after). Labor = quantity × minutes per unit ÷ 60 × man cost per hour.</p>
      </div>
    </div>
  );
}
