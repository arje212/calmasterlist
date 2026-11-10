import React from 'react';
import { addDays, isSameDay, startOfWeek } from 'date-fns';
import { Card, cn } from '@/components/budget/ui';
import { toDate } from '@/lib/calibration';
import { STATUSES, assigneeOf, dueInfo, statusOf } from '@/lib/tasks';
import Avatar from './Avatar';

const DARK = 'rounded-2xl bg-gradient-to-br from-[#0f172a] to-[#1e2a5a] p-5 text-white';
const mono = 'font-mono text-[10.5px] tracking-[.12em] text-[#aab4e0]';

function DueRow({ task }) {
  const info = dueInfo(task);
  const tone = { red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-800', slate: 'bg-[#f6f3ff] text-[#5b5675]' }[info.tone];
  return (
    <div className="flex items-center gap-3 border-b border-[#f1eefb] py-2.5 last:border-0">
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{task.title}</span>
      <span className={cn('whitespace-nowrap rounded-lg px-2 py-0.5 text-[11.5px] font-semibold', tone)}>{info.label}</span>
    </div>
  );
}

const byDue = (a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));

export function MyPanel({ tasks, me, isAdmin }) {
  const open = tasks.filter((t) => statusOf(t) !== 'done');
  const done = tasks.length - open.length;
  const overdue = open.filter((t) => dueInfo(t).group === 'overdue').length;
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
    const day = addDays(monday, i);
    return { label, n: tasks.filter((t) => statusOf(t) === 'done' && toDate(t.completed_at) && isSameDay(toDate(t.completed_at), day)).length };
  });
  const max = Math.max(1, ...week.map((w) => w.n));
  const soon = open.filter((t) => t.due_date).sort(byDue).slice(0, 4);
  const name = me?.full_name || me?.email || 'You';

  return (
    <div className="flex flex-col gap-4">
      <div className={DARK}>
        <div className="flex items-center gap-3.5">
          <Avatar person={{ email: me?.email || name, name }} size={52} ring={false} />
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold">{name}</div>
            <div className={cn(mono, 'mt-1')}>{isAdmin ? 'ADMIN' : 'USER'}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {[['OPEN', open.length], ['DONE', done], ['OVERDUE', overdue]].map(([l, v]) => (
            <div key={l}><div className="text-2xl font-extrabold">{v}</div><div className={cn(mono, 'mt-0.5 tracking-[.08em]')}>{l}</div></div>
          ))}
        </div>
      </div>
      <Card className="p-5">
        <div className="text-base font-bold">Completed this week</div>
        <div className="mt-0.5 text-xs text-[#5b5675]">Tasks you finished each day</div>
        <div className="mt-3.5 flex h-[110px] items-end gap-2">
          {week.map((w) => (
            <div key={w.label} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[11px] font-bold text-[#5b5675]">{w.n}</span>
              <span className="w-full max-w-[26px] rounded-t-md rounded-b-sm bg-[#7c5cfc]" style={{ height: Math.max(4, (w.n / max) * 70) }} />
              <span className="text-[11px] text-[#5b5675]">{w.label}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <div className="text-base font-bold">Due soon</div>
        <div className="mb-1.5 mt-0.5 text-xs text-[#5b5675]">Your next deadlines</div>
        {soon.length ? soon.map((t) => <DueRow key={t.id} task={t} />) : <p className="py-3 text-sm text-[#5b5675]">Nothing with a due date.</p>}
      </Card>
    </div>
  );
}

export function TeamPanel({ tasks, people }) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s.key, tasks.filter((t) => statusOf(t) === s.key).length]));
  const total = tasks.length;
  const donePct = total ? Math.round((counts.done / total) * 100) : 0;
  const R = 44; const C = 2 * Math.PI * R;
  const work = people
    .map((p) => {
      const mine = tasks.filter((t) => assigneeOf(t).toLowerCase() === p.email.toLowerCase());
      return { p, open: mine.filter((t) => statusOf(t) !== 'done').length, done: mine.filter((t) => statusOf(t) === 'done').length };
    })
    .filter((w) => w.open + w.done > 0)
    .sort((a, b) => b.open - a.open);
  const wmax = Math.max(1, ...work.map((w) => w.open + w.done));
  const attention = tasks.filter((t) => statusOf(t) !== 'done' && dueInfo(t).diff != null && dueInfo(t).diff <= 2).sort(byDue).slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <div className={DARK}>
        <div className={mono}>TEAM OVERVIEW</div>
        <div className="mt-3.5 flex flex-wrap items-center gap-4">
          <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`${donePct} percent done`}>
            <g transform="rotate(-90 56 56)" fill="none" strokeWidth="12">
              <circle cx="56" cy="56" r={R} stroke="#2b3560" />
              <circle cx="56" cy="56" r={R} stroke="#10b981" strokeLinecap="round" strokeDasharray={`${(donePct / 100) * C} ${C}`} />
            </g>
            <text x="56" y="62" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">{donePct}%</text>
          </svg>
          <div className="flex min-w-[120px] flex-1 flex-col gap-2">
            {STATUSES.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-[3px]" style={{ background: s.color }} /><span className="text-[#cbd5f5]">{s.label}</span><b className="ml-auto">{counts[s.key]}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3.5 text-xs text-[#aab4e0]">{total} tasks across {work.length} {work.length === 1 ? 'person' : 'people'}, {counts.done} completed</div>
      </div>
      <Card className="p-5">
        <div className="text-base font-bold">Workload</div>
        <div className="mt-0.5 text-xs text-[#5b5675]">Open tasks / done, per person</div>
        <div className="mt-1">
          {work.length === 0 && <p className="py-3 text-sm text-[#5b5675]">No tasks yet.</p>}
          {work.map(({ p, open, done }) => (
            <div key={p.email} className="mt-3.5 flex items-center gap-3">
              <Avatar person={p} size={28} ring={false} />
              <span className="w-24 truncate text-[13px] font-semibold" title={p.name}>{p.name}</span>
              <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-[#ece8fb]">
                <span className="bg-[#7c5cfc]" style={{ width: `${(open / wmax) * 100}%` }} />
                <span className="bg-[#10b981]" style={{ width: `${(done / wmax) * 100}%` }} />
              </span>
              <b className="w-11 text-right text-xs tabular-nums">{open} / {done}</b>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <div className="text-base font-bold">Needs attention</div>
        <div className="mb-1.5 mt-0.5 text-xs text-[#5b5675]">Overdue or due within 2 days</div>
        {attention.length ? attention.map((t) => <DueRow key={t.id} task={t} />) : <p className="py-3 text-sm text-[#5b5675]">Nothing urgent.</p>}
      </Card>
    </div>
  );
}
