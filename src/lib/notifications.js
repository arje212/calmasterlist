import { fmtDate } from '@/lib/calibration';

// Builds the existing equipment alerts from current data.
export function buildNotifications({ equipment, settings }) {
  const list = [];
  equipment.forEach((e) => {
    const base = { link: `/equipment/${e.id}`, date: e.next_due };
    if (e.status === 'expired') list.push({ ...base, id: `exp-${e.id}-${e.next_due}`, type: 'expired', severity: 'red', title: `${e.equipment_name} has expired`, message: `${e.equipment_code} was due on ${fmtDate(e.next_due)}.` });
    else if (e.status === 'due_soon') list.push({ ...base, id: `due-${e.id}-${e.next_due}`, type: 'due_soon', severity: 'orange', title: `${e.equipment_name} due within ${settings.due_soon_days} days`, message: `${e.equipment_code} is due on ${fmtDate(e.next_due)} (${e.days_left} days left).` });
    else if (e.status === 'near') list.push({ ...base, id: `near-${e.id}-${e.next_due}`, type: 'near', severity: 'yellow', title: `${e.equipment_name} expiring within ${settings.near_days} days`, message: `${e.equipment_code} is due on ${fmtDate(e.next_due)}.` });
    if (e.report_state === 'required') list.push({ id: `req-${e.latestVr.id}`, type: 'pending', severity: 'red', link: `/equipment/${e.id}`, date: e.latestVr.verification_date, title: `Report required for ${e.equipment_name}`, message: `Verified on ${fmtDate(e.latestVr.verification_date)} — no report has been created yet.` });
  });
  return list;
}

const KEY = 'calibration_read_notifications';
export const getReadIds = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
};
export function markRead(ids) {
  const set = getReadIds();
  ids.forEach((i) => set.add(i));
  localStorage.setItem(KEY, JSON.stringify([...set]));
  window.dispatchEvent(new Event('notifications-read'));
}