import React from 'react';
import { format } from 'date-fns';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { Chip, cn } from '@/components/budget/ui';
import { toDate } from '@/lib/calibration';
import { PRIORITIES, assigneeOf, dueInfo, findPerson, priorityOf, progressOf, statusOf } from '@/lib/tasks';
import Avatar from './Avatar';

const DUE_TONE = {
  slate: 'bg-[#f6f3ff] text-[#5b5675]',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  green: 'bg-emerald-100 text-emerald-800',
};

export default function TaskCard({ task, people, showAssignee, onOpen }) {
  const status = statusOf(task);
  const done = status === 'done';
  const pri = PRIORITIES[priorityOf(task)];
  const info = dueInfo(task);
  const completed = toDate(task.completed_at);
  const person = findPerson(people, assigneeOf(task));
  const progress = progressOf(task);
  const showProgress = status === 'in_progress' || status === 'in_review';

  const open = () => onOpen(task);
  return (
    <div
      role="button" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      className="cursor-pointer rounded-2xl border border-[#e7e3f7] bg-white p-3.5 shadow-[0_2px_8px_rgba(90,60,200,.06)] transition-shadow hover:shadow-[0_6px_18px_rgba(90,60,200,.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cfc]"
    >
      <div className="mb-2.5">{done ? <Chip tone="green">Completed</Chip> : <Chip tone={pri.tone}>{pri.label}</Chip>}</div>
      <div className={cn('text-sm font-bold leading-snug', done ? 'text-[#8b86a5] line-through' : 'text-[#1b1740]')}>{task.title}</div>
      {task.description && <div className="mt-1 line-clamp-2 text-xs leading-snug text-[#5b5675]">{task.description}</div>}

      {showProgress && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] font-semibold text-[#5b5675]"><span>Progress</span><span>{progress}%</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ece8fb]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[#7c5cfc]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {done ? (
          <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold', DUE_TONE.green)}>
            <CheckCircle2 className="h-3.5 w-3.5" />{completed ? `Done ${format(completed, 'MMM d')}` : 'Done'}
          </span>
        ) : (
          <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold', DUE_TONE[info.tone])}>
            <CalendarDays className="h-3.5 w-3.5" />{info.label}
          </span>
        )}
        {showAssignee && <Avatar person={person} />}
      </div>
    </div>
  );
}
