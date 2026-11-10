import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toDate } from '@/lib/calibration';
import { PRIORITIES, STATUSES, assigneeOf, priorityOf, progressOf, statusOf } from '@/lib/tasks';

const field = 'h-11 w-full rounded-xl border border-[#e0daf5] bg-[#faf9ff] px-3 text-sm text-[#1b1740] focus:outline-none focus:ring-2 focus:ring-[#7c5cfc]';
const label = 'flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#5b5675]';

const toForm = (task, defaults) => {
  if (task?.id) {
    const d = toDate(task.due_date);
    return {
      title: task.title || '', description: task.description || '', assignee_email: assigneeOf(task),
      priority: priorityOf(task), status: statusOf(task), due_date: d ? format(d, 'yyyy-MM-dd') : '', progress: progressOf(task),
    };
  }
  return { title: '', description: '', assignee_email: '', priority: 'medium', status: 'todo', due_date: '', progress: 0, ...defaults };
};

export default function TaskDialog({ open, task, defaults, people, canDelete, saving, onClose, onSave, onDelete }) {
  const [f, setF] = useState(() => toForm(task, defaults));
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (open) { setF(toForm(task, defaults)); setArmed(false); } }, [open, task, defaults]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const editing = !!task?.id;
  const showProgress = f.status === 'in_progress' || f.status === 'in_review';

  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    onSave({
      title: f.title.trim(),
      description: f.description.trim(),
      assignee_email: f.assignee_email || null,
      priority: f.priority,
      status: f.status,
      due_date: f.due_date || null,
      progress: f.status === 'done' ? 100 : showProgress ? Number(f.progress) || 0 : 0,
    }, task);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader><DialogTitle className="text-lg font-extrabold">{editing ? 'Edit task' : 'New task'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className={label}>Title
            <input className={field} value={f.title} onChange={set('title')} placeholder="What needs to be done?" autoFocus required />
          </label>
          <label className={label}>Description
            <textarea className={`${field} h-24 resize-none py-2.5`} value={f.description} onChange={set('description')} placeholder="Optional details" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={label}>Assigned to
              <select className={field} value={f.assignee_email} onChange={set('assignee_email')}>
                <option value="">Unassigned</option>
                {people.map((p) => <option key={p.email} value={p.email}>{p.name}</option>)}
              </select>
            </label>
            <label className={label}>Due date
              <input type="date" className={field} value={f.due_date} onChange={set('due_date')} />
            </label>
            <label className={label}>Status
              <select className={field} value={f.status} onChange={set('status')}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <label className={label}>Priority
              <select className={field} value={f.priority} onChange={set('priority')}>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
          </div>
          {showProgress && (
            <label className={label}>Progress · {f.progress}%
              <input type="range" min="0" max="100" step="5" value={f.progress} onChange={set('progress')} className="h-11 w-full accent-[#7c5cfc]" />
            </label>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            {editing && canDelete ? (
              <Button type="button" variant={armed ? 'destructive' : 'ghost'} className={armed ? '' : 'text-red-600 hover:bg-red-50'} onClick={() => (armed ? onDelete(task) : setArmed(true))}>
                {armed ? 'Click again to delete' : 'Delete'}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="bg-[#7c5cfc] hover:bg-[#6a49f0]" disabled={saving || !f.title.trim()}>{editing ? 'Save' : 'Add task'}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
