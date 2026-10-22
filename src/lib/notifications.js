import { fmtDate } from '@/lib/calibration';

// Builds live in-app notifications from current data
export function buildNotifications({ equipment, reports, settings, me }) {
  const canReview = me?.role === 'admin' || me?.role === 'sr_staff';
  const canApprove = me?.role === 'admin' || me?.role === 'qa_manager';
  const list = [];
  equipment.forEach((e) => {
    const base = { link: `/equipment/${e.id}`, date: e.next_due };
    if (e.status === 'expired') list.push({ ...base, id: `exp-${e.id}-${e.next_due}`, type: 'expired', severity: 'red', title: `${e.equipment_name} has expired`, message: `${e.equipment_code} was due on ${fmtDate(e.next_due)}.` });
    else if (e.status === 'due_soon') list.push({ ...base, id: `due-${e.id}-${e.next_due}`, type: 'due_soon', severity: 'orange', title: `${e.equipment_name} due within ${settings.due_soon_days} days`, message: `${e.equipment_code} is due on ${fmtDate(e.next_due)} (${e.days_left} days left).` });
    else if (e.status === 'near') list.push({ ...base, id: `near-${e.id}-${e.next_due}`, type: 'near', severity: 'yellow', title: `${e.equipment_name} expiring within ${settings.near_days} days`, message: `${e.equipment_code} is due on ${fmtDate(e.next_due)}.` });
    if (e.report_state === 'required') list.push({ id: `req-${e.latestVr.id}`, type: 'pending', severity: 'red', link: `/equipment/${e.id}`, date: e.latestVr.verification_date, title: `Report required for ${e.equipment_name}`, message: `Verified on ${fmtDate(e.latestVr.verification_date)} — no report has been created yet.` });
  });
  reports.forEach((r) => {
    const mine = r.created_by_id === me?.id;
    const label = `${r.report_number} · ${r.equipment_snapshot?.equipment_name || ''}`;
    const base = { link: `/reports/${r.id}`, date: r.updated_date };
    if ((canReview && r.status === 'submitted') || (canApprove && r.status === 'reviewed')) list.push({ ...base, id: `rev-${r.id}-${r.status}`, type: 'action', severity: 'blue', title: r.status === 'submitted' ? 'Report awaiting Sr. Staff review' : 'Report awaiting QA Manager approval', message: label });
    if (mine && r.status === 'rejected') list.push({ ...base, id: `rej-${r.id}-${r.updated_date}`, type: 'rejected', severity: 'red', title: 'Report rejected', message: `${label} — ${r.rejection_reason || 'see reason'}` });
    if (mine && r.status === 'approved') list.push({ ...base, id: `app-${r.id}`, type: 'approved', severity: 'green', title: 'Report approved', message: label });
  });
  return list;
}

const KEY = 'calibration_read_notifications';
export const getReadIds = () => new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
export function markRead(ids) {
  const set = getReadIds();
  ids.forEach((i) => set.add(i));
  localStorage.setItem(KEY, JSON.stringify([...set]));
  window.dispatchEvent(new Event('notifications-read'));
}