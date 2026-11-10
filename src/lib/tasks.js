// src/lib/tasks.js
// Mga constant at helper ng Tasks board. Compatible sa lumang Task (title, due_date, done, created_by_email).
import { differenceInCalendarDays, format, startOfToday } from 'date-fns';
import { toDate } from '@/lib/calibration';

export const STATUSES = [
  { key: 'todo', label: 'To do', color: '#94a3b8' },
  { key: 'in_progress', label: 'In progress', color: '#7c5cfc' },
  { key: 'in_review', label: 'In review', color: '#f59e0b' },
  { key: 'done', label: 'Done', color: '#10b981' },
];
export const PRIORITIES = {
  high: { label: 'High', tone: 'red' },
  medium: { label: 'Medium', tone: 'amber' },
  low: { label: 'Low', tone: 'green' },
};

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

// Kung walang status ang lumang task, hango ito sa "done"
export const statusOf = (t) => (STATUSES.some((s) => s.key === t.status) ? t.status : t.done ? 'done' : 'todo');
// Kung walang assignee ang lumang task, ang gumawa ang may hawak
export const assigneeOf = (t) => t.assignee_email || t.created_by_email || '';
export const priorityOf = (t) => (PRIORITIES[t.priority] ? t.priority : 'medium');
export const progressOf = (t) => (statusOf(t) === 'done' ? 100 : clamp(Number(t.progress) || 0));

export function dueInfo(t, today = startOfToday()) {
  const d = toDate(t.due_date);
  if (!d) return { group: 'none', label: 'No due date', tone: 'slate', date: null, diff: null };
  const diff = differenceInCalendarDays(d, today);
  if (diff < 0) return { group: 'overdue', label: `${Math.abs(diff)} d overdue`, tone: 'red', date: d, diff };
  if (diff === 0) return { group: 'today', label: 'Today', tone: 'amber', date: d, diff };
  if (diff === 1) return { group: 'upcoming', label: 'Tomorrow', tone: 'amber', date: d, diff };
  return { group: 'upcoming', label: format(d, 'MMM d'), tone: 'slate', date: d, diff };
}

export const initialsOf = (s = '') => {
  const base = String(s).split('@')[0].replace(/[._-]+/g, ' ').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const PALETTE = ['#6d4af0', '#be185d', '#0369a1', '#b45309', '#047857', '#7c3aed', '#b91c1c'];
export const colorOf = (key = '') => {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

// Pinagsamang listahan ng tao: users (kung kaya) + lahat ng email na nasa tasks + ako
export function buildPeople(users = [], tasks = [], me) {
  const map = new Map();
  const add = (email, name) => {
    if (!email) return;
    const k = String(email).toLowerCase();
    const prev = map.get(k);
    map.set(k, { email: String(email), name: name || prev?.name || String(email).split('@')[0] });
  };
  users.forEach((u) => add(u.email, u.full_name || u.name));
  tasks.forEach((t) => { add(t.assignee_email); add(t.created_by_email); });
  if (me?.email) add(me.email, me.full_name);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export const findPerson = (people, email) => people.find((p) => p.email.toLowerCase() === String(email || '').toLowerCase());
