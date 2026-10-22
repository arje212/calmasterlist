// src/lib/budgetPlan.js
// Data, computations at storage ng 2027 Action Plan (budget savings).
// Naka-save sa localStorage. Kapag may API ka na, palitan lang ang loadPlan() at savePlan().
import { useCallback, useEffect, useRef, useState } from 'react';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PROJECTS = {
  report: { key: 'report', name: 'Calibration report preparation', sub: 'Excel-based to Web-based', short: 'Report' },
  sticker: { key: 'sticker', name: 'Calibration sticker preparation', sub: 'Manual to sticker printer', short: 'Sticker' },
};

const KEY = 'calibratrack.budgetPlan.v1';
const EVENT = 'budgetplan:changed';
const rep = (v) => Array(12).fill(v);
const FIELDS = ['before', 'after', 'matB', 'matA', 'act'];

// Materials "before" ng sticker (bond paper, tape), USD kada buwan, galing sa 6. STU_Sticker
const STICKER_MAT_B = [0.8892, 1.0764, 0.1716, 0.7332, 0.4992, 1.1544, 0.78, 0.6552, 1.17, 0.4212, 0.3432, 1.482];

export const defaultPlan = () => ({
  year: 2027,
  manCost: 800, // PHP per day
  hours: 8, // working hours per day
  forex: 61, // PHP per USD
  useApp: true, // bilangin ang approved reports sa app bilang actual savings
  qty: [57, 69, 11, 47, 32, 74, 50, 42, 75, 27, 22, 95],
  report: { before: rep(19), after: rep(4), matB: rep(0), matA: rep(0), act: rep(null) },
  sticker: { before: rep(13), after: rep(2), matB: [...STICKER_MAT_B], matA: rep(0), act: rep(null) },
});

export const blankPlan = () => {
  const d = defaultPlan();
  d.qty = rep(0);
  ['report', 'sticker'].forEach((p) => ['before', 'after', 'matB', 'matA'].forEach((k) => { d[p][k] = rep(0); }));
  return d;
};

const isValid = (o) =>
  o && Array.isArray(o.qty) && o.qty.length === 12 &&
  ['report', 'sticker'].every((p) => o[p] && FIELDS.every((k) => Array.isArray(o[p][k]) && o[p][k].length === 12));

export function loadPlan() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (isValid(o)) return { ...defaultPlan(), ...o };
    }
  } catch { /* gumamit ng default */ }
  return defaultPlan();
}

export function savePlan(plan) {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

// Hook: gamitin sa Dashboard at sa Budget Entry para magkapareho ang data
export function usePlan() {
  const [plan, setPlanState] = useState(loadPlan);
  const [savedAt, setSavedAt] = useState(null);
  const ref = useRef(plan);

  useEffect(() => {
    const sync = () => { const next = loadPlan(); ref.current = next; setPlanState(next); };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  const setPlan = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(ref.current) : updater;
    ref.current = next;
    setPlanState(next);
    if (savePlan(next)) setSavedAt(new Date());
  }, []);

  return { plan, setPlan, savedAt };
}

// Palitan ang isang cell nang hindi ginagalaw ang orihinal na object
export const setCellIn = (plan, project, field, i, value) => ({
  ...plan,
  [project]: { ...plan[project], [field]: plan[project][field].map((v, idx) => (idx === i ? value : v)) },
});
export const setQtyIn = (plan, i, value) => ({ ...plan, qty: plan.qty.map((v, idx) => (idx === i ? value : v)) });

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (arr) => arr.reduce((a, b) => a + num(b), 0);
const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

export const hourlyUsd = (p) => (p.hours > 0 && p.forex > 0 ? p.manCost / p.hours / p.forex : 0);

// Bilang ng approved reports kada buwan sa taon ng plan (isang sticker kada approved report)
export function autoUnitsFromReports(reports = [], year) {
  const units = Array(12).fill(0);
  (reports || []).forEach((r) => {
    if (r?.status !== 'approved') return;
    const d = new Date(r.approved_at || r.approved_date || r.calibration_date || r.created_date || r.created_at);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== Number(year)) return;
    units[d.getMonth()] += 1;
  });
  return units;
}

// Lahat ng kuwenta. Formula: savings = (labor + materials before) − (labor + materials after)
export function computePlan(plan, autoUnits = null) {
  const rate = hourlyUsd(plan);

  const build = (pk) => {
    const P = plan[pk];
    let ytd = 0;
    const months = MONTHS.map((_, i) => {
      const qty = num(plan.qty[i]);
      const laborB = ((qty * num(P.before[i])) / 60) * rate;
      const laborA = ((qty * num(P.after[i])) / 60) * rate;
      const costB = laborB + num(P.matB[i]);
      const costA = laborA + num(P.matA[i]);
      const budget = costB - costA;
      ytd += budget;
      let actSav = null;
      let auto = false;
      if (P.act[i] != null) actSav = costB - num(P.act[i]);
      else if (autoUnits && autoUnits[i] > 0) { actSav = autoUnits[i] * (((num(P.before[i]) - num(P.after[i])) / 60) * rate); auto = true; }
      return { qty, laborB, laborA, costB, costA, budget, ytd, actSav, auto, ach: actSav == null || budget === 0 ? null : actSav / budget };
    });
    const withAct = months.filter((m) => m.actSav != null);
    const budget = sum(months.map((m) => m.budget));
    const actual = withAct.length ? sum(withAct.map((m) => m.actSav)) : null;
    return {
      months,
      totals: {
        qty: sum(months.map((m) => m.qty)), laborB: sum(months.map((m) => m.laborB)), laborA: sum(months.map((m) => m.laborA)),
        costB: sum(months.map((m) => m.costB)), costA: sum(months.map((m) => m.costA)),
        budget, actual, ach: actual == null || !budget ? null : actual / budget,
        avgBefore: avg(P.before), avgAfter: avg(P.after),
      },
    };
  };

  const projects = { report: build('report'), sticker: build('sticker') };
  const monthlyBudget = MONTHS.map((_, i) => projects.report.months[i].budget + projects.sticker.months[i].budget);
  const monthlyActual = MONTHS.map((_, i) => {
    const a = projects.report.months[i].actSav;
    const b = projects.sticker.months[i].actSav;
    return a == null && b == null ? null : num(a) + num(b);
  });
  let cb = 0; let ca = 0;
  const lastActual = monthlyActual.reduce((acc, v, i) => (v != null ? i : acc), -1);
  const cumBudget = monthlyBudget.map((v) => (cb += v));
  const cumActual = monthlyActual.map((v, i) => { ca += num(v); return i <= lastActual ? ca : null; });
  const budget = sum(monthlyBudget);
  const hasActual = lastActual >= 0;
  const actual = hasActual ? sum(monthlyActual) : null;
  const perUnit = {
    report: ((projects.report.totals.avgBefore - projects.report.totals.avgAfter) / 60) * rate,
    sticker: ((projects.sticker.totals.avgBefore - projects.sticker.totals.avgAfter) / 60) * rate,
  };

  return { rate, projects, perUnit, total: { budget, actual, hasActual, ach: hasActual && budget ? actual / budget : null, monthlyBudget, monthlyActual, cumBudget, cumActual } };
}

export function planToCsv(plan, c) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const f = (v, d = 4) => (v == null ? '' : Number(v).toFixed(d));
  const lines = [
    ['Year', plan.year], ['Man cost (PHP/day)', plan.manCost], ['Hours per day', plan.hours], ['Forex (PHP/USD)', plan.forex],
    ['Man cost (USD/hour)', c.rate.toFixed(4)], [], ['Month', ...MONTHS, 'Total'], ['Quantity', ...plan.qty, sum(plan.qty)],
  ];
  Object.values(PROJECTS).forEach(({ key, name }) => {
    const { months, totals } = c.projects[key];
    const add = (label, arr, total) => lines.push([label, ...arr.map((v) => f(v)), f(total)]);
    lines.push([], [name]);
    add('Cycle time before (min/unit)', plan[key].before, totals.avgBefore);
    add('Cycle time after (min/unit)', plan[key].after, totals.avgAfter);
    add('Materials before (USD)', plan[key].matB, sum(plan[key].matB));
    add('Materials after (USD)', plan[key].matA, sum(plan[key].matA));
    add('Labor cost before (USD)', months.map((m) => m.laborB), totals.laborB);
    add('Labor cost after (USD)', months.map((m) => m.laborA), totals.laborA);
    add('Budget savings (USD)', months.map((m) => m.budget), totals.budget);
    add('Actual cost after (USD)', plan[key].act, null);
    add('Actual savings (USD)', months.map((m) => m.actSav), totals.actual);
    lines.push(['Achievement rate', ...months.map((m) => (m.ach == null ? '' : `${(m.ach * 100).toFixed(1)}%`)), totals.ach == null ? '' : `${(totals.ach * 100).toFixed(1)}%`]);
  });
  return lines.map((r) => r.map(q).join(',')).join('\n');
}

export function downloadCsv(filename, text) {
  const blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
