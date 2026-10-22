import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/api/apiClient';
import { useMe, useInvalidate } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';
import { toDate } from '@/lib/calibration';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';

export default function Tasks() {
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiClient.entities.Task.list('-created_date', 500),
  });
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [filter, setFilter] = useState('open');
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const created = await apiClient.entities.Task.create({
        title: title.trim(),
        due_date: dueDate || null,
        done: false,
        created_by_email: me?.email,
      });
      await logAudit(me, { action: 'task_create', entity_type: 'Task', entity_id: created?.id, entity_label: title.trim() });
      setTitle('');
      setDueDate('');
      invalidate('tasks');
      toast.success('Task added');
    } catch (error) {
      toast.error(error.message || 'Could not add task');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (t) => {
    try {
      await apiClient.entities.Task.update(t.id, { done: !t.done });
      invalidate('tasks');
    } catch (error) {
      toast.error(error.message || 'Could not update task');
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    try {
      await apiClient.entities.Task.delete(t.id);
      await logAudit(me, { action: 'task_delete', entity_type: 'Task', entity_id: t.id, entity_label: t.title });
      invalidate('tasks');
      toast.success('Task deleted');
    } catch (error) {
      toast.error(error.message || 'Could not delete task');
    }
  };

  const openCount = tasks.filter((t) => !t.done).length;
  const shown = tasks.filter((t) => filter === 'all' || (filter === 'open' ? !t.done : !!t.done));

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Tasks" description={`${openCount} open`} />

      <form onSubmit={add} className="panel p-4 mb-4 flex flex-col sm:flex-row gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task…" className="flex-1" />
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="sm:w-44" />
        <Button type="submit" className="gap-2" disabled={saving || !title.trim()}>
          <Plus className="h-4 w-4" />Add
        </Button>
      </form>

      <div className="flex gap-2 pb-2 mb-4">
        {['open', 'done', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize ${filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingState /> : shown.length === 0 ? (
        <div className="panel"><EmptyState icon={ClipboardList} title="No tasks here" /></div>
      ) : (
        <div className="panel divide-y fade-up">
          {shown.map((t) => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3">
              <input type="checkbox" checked={!!t.done} onChange={() => toggle(t)} className="h-4 w-4" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${t.done ? 'line-through text-muted-foreground' : 'text-slate-900'}`}>{t.title}</p>
                {toDate(t.due_date) && (
                  <p className="text-xs text-muted-foreground mt-0.5">Due {format(toDate(t.due_date), 'MMM d, yyyy')}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(t)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}