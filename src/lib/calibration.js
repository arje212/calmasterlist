import { differenceInCalendarDays, addMonths, endOfMonth, startOfDay, subDays, subMonths, format, parseISO, isValid, startOfMonth } from 'date-fns';

export const DEFAULT_SETTINGS = {
  org_name: 'Metrology & Quality Control Unit',
  org_logo_url: '',
  document_title: 'Calibration / Verification Report',
  near_days: 30,
  due_soon_days: 7,
  result_pass_desc: 'Equipment meets the required verification/calibration criteria.',
  result_partial_desc: 'Equipment partially meets requirements and has identified limitations.',
  result_conditional_desc: 'Equipment may continue to be used subject to specified conditions/restrictions.',
  result_failed_desc: 'Equipment does not meet the required criteria.',
};

export const STATUS_META = {
  valid: { label: 'Done Verification', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', hero: 'bg-emerald-500', soft: 'bg-emerald-50 border-emerald-200 text-emerald-800', hex: '#10b981' },
  near: { label: 'For Verify', dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-800 ring-yellow-600/25', hero: 'bg-yellow-400', soft: 'bg-yellow-50 border-yellow-200 text-yellow-900', hex: '#eab308' },
  due_soon: { label: 'Near Expiration', dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 ring-orange-600/20', hero: 'bg-orange-500', soft: 'bg-orange-50 border-orange-200 text-orange-800', hex: '#f97316' },
  expired: { label: 'Expired', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 ring-red-600/20', hero: 'bg-red-500', soft: 'bg-red-50 border-red-200 text-red-800', hex: '#ef4444' },
  unknown: { label: 'No Due Date', dot: 'bg-slate-300', badge: 'bg-slate-50 text-slate-600 ring-slate-500/20', hero: 'bg-slate-400', soft: 'bg-slate-50 border-slate-200 text-slate-700', hex: '#94a3b8' },
};

// PASS = blue, PARTIAL = green, CONDITIONAL = white (grey outline so it stays visible), FAILED = red
export const RESULT_META = {
  pass: { label: 'PASS', badge: 'bg-blue-50 text-blue-700 ring-blue-600/20', solid: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-600', hex: '#2563eb' },
  partial: { label: 'PARTIAL', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', solid: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-600', hex: '#059669' },
  conditional: { label: 'CONDITIONAL', badge: 'bg-white text-slate-700 ring-slate-400', solid: 'bg-white ring-2 ring-slate-400', text: 'text-slate-900', border: 'border-slate-600', hex: '#cbd5e1' },
  failed: { label: 'FAILED', badge: 'bg-red-50 text-red-700 ring-red-600/20', solid: 'bg-red-600', text: 'text-red-700', border: 'border-red-600', hex: '#dc2626' },
};

export const isExternalCalibration = (equipment) => String(equipment?.calibration_type || '').trim().toLowerCase() === 'external provider calibration';

export const REPORT_STATUS_META = {
  draft: { label: 'Draft', badge: 'bg-slate-100 text-slate-700 ring-slate-500/20' },
  submitted: { label: 'Submitted', badge: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  reviewed: { label: 'Reviewed', badge: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' },
  approved: { label: 'Approved', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  rejected: { label: 'Rejected', badge: 'bg-red-50 text-red-700 ring-red-600/20' },
  required: { label: 'Report Required', badge: 'bg-red-600 text-white ring-red-700/30' },
  none: { label: '—', badge: 'bg-transparent text-slate-400 ring-transparent' },
};

export const RESULTS = ['pass', 'partial', 'conditional', 'failed'];
export const STATUSES = ['valid', 'near', 'due_soon', 'expired', 'unknown'];

export const FIELD_LABELS = {
  equipment_code: 'Control Number', equipment_name: 'Equipment Name', description: 'Range', category: 'Equipment Type',
  manufacturer: 'Maker', model: 'Model', serial_number: 'Serial Number', asset_number: 'Asset Number',
  location: 'Location', department: 'Department', responsible_person: 'Responsible Person',
  calibration_type: 'Verification', frequency_months: 'Frequency (months)',
  last_verification_date: 'Last Verification Date', next_due_date: 'Next Verification Date',
  last_result: 'Result', certificate_number: 'Certificate Number', remarks: 'Remarks',
};

export const toDate = (s) => {
  if (!s) return null;
  const d = typeof s === 'string' ? parseISO(s) : new Date(s);
  return isValid(d) ? d : null;
};
export const fmtDate = (s, f = 'dd MMM yyyy') => { const d = toDate(s); return d ? format(d, f) : '—'; };
export const isoDate = (d) => format(d, 'yyyy-MM-dd');
export const today = () => isoDate(new Date());
export const daysUntil = (s) => { const d = toDate(s); return d ? differenceInCalendarDays(d, new Date()) : null; };
export const calcNextDue = (dateStr, months) => { const d = toDate(dateStr); return d ? isoDate(subDays(addMonths(d, Number(months) || 12), 1)) : ''; };
export const nextMonthDueRange = (date = new Date()) => {
  const firstDay = startOfMonth(addMonths(date, 1));
  return { from: isoDate(firstDay), to: isoDate(endOfMonth(firstDay)) };
};

// Status rules (by due date). Verification is done ONE MONTH IN ADVANCE:
// equipment due in November is verified in October.
//   expired   : already past due
//   due_soon  : "Near Expiration"   - due within `due_soon_days` days (default 7) OR due before the end of THIS month
//                                     (its advance-verification window has already passed, so it is urgent)
//   near      : "For Verify"        - due NEXT calendar month (in October: Nov 1 - Nov 30)
//   valid     : "Done Verification" - due later than next month
//   unknown   : no due date
export function computeStatus(nextDue, settings, asOf = new Date()) {
  const d = toDate(nextDue);
  if (!d) return 'unknown';
  const days = differenceInCalendarDays(d, asOf);
  if (days < 0) return 'expired';
  if (days <= Number(settings.due_soon_days) || nextDue <= isoDate(endOfMonth(asOf))) return 'due_soon';
  if (nextDue <= nextMonthDueRange(asOf).to) return 'near';
  return 'valid';
}

const byDateDesc = (a, b) =>
  (b.verification_date || '').localeCompare(a.verification_date || '') || (b.created_date || '').localeCompare(a.created_date || '');

export function enrichEquipment(equipment, verifications, reports, settings) {
  const vrByEq = {};
  verifications.forEach((v) => { (vrByEq[v.equipment_id] ||= []).push(v); });
  const repByVr = {};
  reports.forEach((r) => { (repByVr[r.verification_id] ||= []).push(r); });

  return equipment.map((eq) => {
    const history = (vrByEq[eq.id] || []).slice().sort(byDateDesc);
    const latest = history[0];
    const eqLast = eq.last_verification_date || '';
    const useVr = latest && (latest.verification_date > eqLast ||
      (latest.verification_date === eqLast && (latest.created_date || '') >= (eq.updated_date || '')));
    const next_due = useVr ? latest.next_due_date : eq.next_due_date;
    let report_state = 'none';
    let latestReport = null;
    if (latest) {
      latestReport = (repByVr[latest.id] || []).slice().sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''))[0] || null;
      report_state = latestReport ? latestReport.status : 'required';
    }
    return {
      ...eq,
      history,
      latestVr: latest || null,
      latestReport,
      last_date: useVr ? latest.verification_date : eq.last_verification_date,
      next_due,
      result: useVr ? latest.result : eq.last_result,
      status: computeStatus(next_due, settings),
      days_left: daysUntil(next_due),
      report_state,
      report_required: !!latest && report_state !== 'approved',
      certificate: latestReport?.report_number || eq.certificate_number || '',
    };
  });
}

export function complianceFor(equipment, verifications, asOf = new Date()) {
  const today = startOfDay(asOf);
  const since = startOfDay(subMonths(today, 12));
  const cycles = new Map();
  const inWindow = (date) => date && date >= since && date <= today;

  verifications.forEach((v) => {
    const dueDate = toDate(v.previous_due_date);
    if (!inWindow(dueDate)) return;
    const verificationDate = toDate(v.verification_date);
    const onTime = verificationDate && verificationDate <= dueDate && verificationDate <= today;
    const key = `${v.equipment_id || v.id}:${isoDate(dueDate)}`;
    cycles.set(key, Boolean(cycles.get(key) || onTime));
  });

  equipment.forEach((e) => {
    const dueDate = toDate(e.next_due);
    if (e.status !== 'expired' || !inWindow(dueDate)) return;
    const key = `${e.id}:${isoDate(dueDate)}`;
    if (!cycles.has(key)) cycles.set(key, false);
  });

  const onTime = [...cycles.values()].filter(Boolean).length;
  const due = cycles.size;
  return { onTime, due, pct: due ? Math.round((onTime / due) * 100) : 100 };
}

export function groupStats(equipment, verifications, key = 'department') {
  const eqById = Object.fromEntries(equipment.map((e) => [e.id, e]));
  const groups = {};
  equipment.forEach((e) => {
    const name = e[key] || 'Unassigned';
    const g = (groups[name] ||= { name, total: 0, expired: 0, upcoming: 0, failed: 0, pending: 0, equipment: [], vrs: [] });
    g.total += 1;
    g.equipment.push(e);
    if (e.status === 'expired') g.expired += 1;
    if (e.status === 'near' || e.status === 'due_soon') g.upcoming += 1;
    if (e.result === 'failed') g.failed += 1;
    if (e.report_required) g.pending += 1;
  });
  verifications.forEach((v) => { const e = eqById[v.equipment_id]; if (e) groups[e[key] || 'Unassigned']?.vrs.push(v); });
  return Object.values(groups).map((g) => {
    const { equipment: groupEquipment, ...stats } = g;
    return { ...stats, compliance: complianceFor(groupEquipment, g.vrs).pct };
  }).sort((a, b) => b.total - a.total);
}

export function monthlyTrend(verifications, months = 12) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = startOfMonth(subMonths(new Date(), i));
    buckets.push({ key: format(m, 'yyyy-MM'), month: format(m, 'MMM yy'), verified: 0, passed: 0, failed: 0 });
  }
  const map = Object.fromEntries(buckets.map((b) => [b.key, b]));
  verifications.forEach((v) => {
    const date = toDate(v.verification_date);
    if (!date || date > new Date()) return;
    const b = map[format(date, 'yyyy-MM')];
    if (!b) return;
    b.verified += 1;
    if (v.result === 'pass') b.passed += 1;
    if (v.result === 'failed') b.failed += 1;
  });
  return buckets;
}

export function nextReportNumber(reports, year = new Date().getFullYear()) {
  const existing = new Set(reports.map((r) => r.report_number));
  let n = reports.filter((r) => (r.report_number || '').startsWith(`VR-${year}-`)).length + 1;
  let num;
  do { num = `VR-${year}-${String(n).padStart(4, '0')}`; n += 1; } while (existing.has(num));
  return num;
}

export const resultDesc = (settings, result) => settings[`result_${result}_desc`] || '';