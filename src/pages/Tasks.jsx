import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';
import { taskApi, usingLocalTasks, migrateLocalTasks } from '@/lib/tasksApi';
import { useMe, useInvalidate, useIsAdmin } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import { Chip, cn } from '@/components/budget/ui';
import { STATUSES, PRIORITIES, assigneeOf, buildPeople, dueInfo, statusOf } from '@/lib/tasks';
import TaskCard from '@/components/tasks/TaskCard';
import TaskDialog from '@/components/tasks/TaskDialog';
import Avatar from '@/components/tasks/Avatar';
import { MyPanel, TeamPanel } from '@/components/tasks/TaskSidePanel';

const selectCls = 'h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary';

export default function Tasks() {
  const { data: me } = useMe();
  const isAdmin = useIsAdmin();
  const invalidate = useInvalidate();
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.list('-created_date', 500),
  });
  // Listahan ng users (kung pinapayagan). Kapag hindi, gagamitin ang mga email na nasa tasks.
  const { data: users = [] } = useQuery({
    queryKey: ['task-people'],
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try { return (await apiClient.people.list()) || []; } catch { /* subukan ang User list (admin lang) */ }
      try { return (await apiClient.entities.User.list()) || []; } catch { return []; }
    },
  });
  const people = useMemo(() => buildPeople(users, tasks, me), [users, tasks, me]);

  // Isang beses: ilipat sa server ang mga task na dating naka-save sa browser na ito
  useEffect(() => {
    if (usingLocalTasks()) return;
    migrateLocalTasks().then((n) => {
      if (n > 0) { invalidate('tasks'); toast.success(`Moved ${n} saved task${n > 1 ? 's' : ''} to the server`); }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const myEmail = (me?.email || '').toLowerCase();

  const [scope, setScope] = useState('mine'); // 'mine' | 'team'
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState('all');
  const [priority, setPriority] = useState('all');
  const [due, setDue] = useState('all');
  const [dialog, setDialog] = useState({ open: false, task: null, defaults: {} });
  const [saving, setSaving] = useState(false);

  const canEdit = (t) => isAdmin || assigneeOf(t).toLowerCase() === myEmail || String(t.created_by_email || '').toLowerCase() === myEmail;
  const isMine = (t) => assigneeOf(t).toLowerCase() === myEmail;
  const team = scope === 'team';

  const scoped = useMemo(
    () => tasks.filter((t) => (team ? person === 'all' || assigneeOf(t).toLowerCase() === person.toLowerCase() : isMine(t))),
    [tasks, team, person, myEmail], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((t) => {
      if (q && !`${t.title} ${t.description || ''}`.toLowerCase().includes(q)) return false;
      if (priority !== 'all' && (t.priority || 'medium') !== priority) return false;
      if (due !== 'all') {
        const info = dueInfo(t);
        if (statusOf(t) === 'done') return false;
        if (due === 'overdue' && info.group !== 'overdue') return false;
        if (due === 'week' && !(info.diff != null && info.diff >= 0 && info.diff <= 7)) return false;
      }
      return true;
    });
  }, [scoped, search, priority, due]);

  const columns = STATUSES.map((s) => ({
    ...s,
    items: visible.filter((t) => statusOf(t) === s.key).sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'))),
  }));

  const openNew = (status = 'todo') => setDialog({ open: true, task: null, defaults: { status, assignee_email: me?.email || '' } });
  const openEdit = (task) => setDialog({ open: true, task, defaults: {} });
  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));

  const save = async (payload, task) => {
    setSaving(true);
    const wasDone = task && statusOf(task) === 'done';
    const body = {
      ...payload,
      done: payload.status === 'done',
      completed_at: payload.status === 'done' ? (wasDone && task.completed_at) || new Date().toISOString() : null,
    };
    try {
      if (task?.id) {
        await taskApi.update(task.id, body);
        await logAudit(me, { action: 'task_update', entity_type: 'Task', entity_id: task.id, entity_label: body.title });
      } else {
        const created = await taskApi.create({ ...body, created_by_email: me?.email });
        await logAudit(me, { action: 'task_create', entity_type: 'Task', entity_id: created?.id, entity_label: body.title });
      }
      invalidate('tasks');
      toast.success(task?.id ? 'Task updated' : 'Task added');
      closeDialog();
    } catch (error) {
      toast.error(error.message || 'Could not save task');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (task) => {
    const prev = qc.getQueryData(['tasks']);
    qc.setQueryData(['tasks'], (old = []) => old.filter((x) => x.id !== task.id));
    closeDialog();
    try {
      await taskApi.delete(task.id);
      await logAudit(me, { action: 'task_delete', entity_type: 'Task', entity_id: task.id, entity_label: task.title });
      invalidate('tasks');
      toast.success('Task deleted');
    } catch (error) {
      qc.setQueryData(['tasks'], prev);
      toast.error(error.message || 'Could not delete task');
    }
  };

  // Optimistic: agad lumilipat ang card, ibabalik lang kapag pumalya ang server
  const move = async (task, status) => {
    if (statusOf(task) === status) return;
    const patch = {
      status, done: status === 'done',
      completed_at: status === 'done' ? new Date().toISOString() : null,
      progress: status === 'done' ? 100 : status === 'todo' ? 0 : Number(task.progress) || 0,
    };
    const prev = qc.getQueryData(['tasks']);
    qc.setQueryData(['tasks'], (old = []) => old.map((x) => (x.id === task.id ? { ...x, ...patch } : x)));
    try {
      await taskApi.update(task.id, patch);
      await logAudit(me, { action: 'task_update', entity_type: 'Task', entity_id: task.id, entity_label: task.title });
      invalidate('tasks');
    } catch (error) {
      qc.setQueryData(['tasks'], prev);
      toast.error(error.message || 'Could not move task');
    }
  };

  const onDragEnd = ({ draggableId, destination }) => {
    if (!destination) return;
    const task = tasks.find((t) => String(t.id) === draggableId);
    if (task && canEdit(task)) move(task, destination.droppableId);
  };

  const myTasks = useMemo(() => tasks.filter(isMine), [tasks, myEmail]); // eslint-disable-line react-hooks/exhaustive-deps
  const openCount = (team ? tasks : myTasks).filter((t) => statusOf(t) !== 'done').length;

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Tasks" description={`${openCount} open ${team ? 'across the team' : 'for you'}`}>
        <div className="flex overflow-hidden rounded-[10px] border border-slate-200" role="group" aria-label="Board view">
          {[['mine', 'My tasks'], ['team', 'Team board']].map(([k, label]) => (
            <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)}
              className={cn('min-h-[44px] px-4 text-[13px] font-semibold', scope === k ? 'bg-primary text-white' : 'bg-white text-slate-900')}>{label}</button>
          ))}
        </div>
        <Button className="h-11 gap-2 bg-primary hover:bg-primary/90" onClick={() => openNew()}><Plus className="h-4 w-4" />New task</Button>
      </PageHeader>

      {usingLocalTasks() && (
        <div role="note" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          The server has no Task entity yet, so tasks are saved only in this browser. The Team board will show other people’s tasks once the entity is added.
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <label className="flex h-11 min-w-[220px] max-w-[360px] flex-1 items-center gap-2.5 rounded-[10px] border border-slate-200 bg-white px-3 text-sm focus-within:ring-2 focus-within:ring-primary">
          <Search className="h-4 w-4 text-slate-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="w-full bg-transparent outline-none" />
        </label>
        {team && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by person">
            <button aria-pressed={person === 'all'} onClick={() => setPerson('all')}
              className={cn('min-h-[44px] rounded-full border px-4 text-[13px] font-semibold', person === 'all' ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white')}>All people</button>
            {people.map((p) => (
              <button key={p.email} aria-pressed={person === p.email} onClick={() => setPerson(p.email)}
                className={cn('flex min-h-[44px] items-center gap-2 rounded-full border px-3 text-[13px] font-semibold', person === p.email ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white')}>
                <Avatar person={p} size={22} ring={false} />{p.name}
              </button>
            ))}
          </div>
        )}
        <select aria-label="Priority" className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="all">All priorities</option>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select aria-label="Due date" className={selectCls} value={due} onChange={(e) => setDue(e.target.value)}>
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="week">Next 7 days</option>
        </select>
      </div>

      {isLoading ? <LoadingState /> : (
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start fade-up">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-2 min-[1500px]:grid-cols-4">
              {columns.map((col) => (
                <section key={col.key} aria-label={col.label} className="rounded-2xl bg-slate-100/50 p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-slate-600">
                      <span className="h-2 w-2 rounded-[3px]" style={{ background: col.color }} />{col.label}
                      <Chip>{col.items.length}</Chip>
                    </h3>
                    <button aria-label={`Add task to ${col.label}`} onClick={() => openNew(col.key)}
                      className="flex h-11 w-11 items-center justify-center rounded-[10px] text-primary hover:bg-white/70"><Plus className="h-4 w-4" /></button>
                  </div>
                  <Droppable droppableId={col.key}>
                    {(prov, snap) => (
                      <div ref={prov.innerRef} {...prov.droppableProps} className={cn('flex min-h-[120px] flex-col gap-3 rounded-xl transition-colors', snap.isDraggingOver && 'bg-primary/10')}>
                        {col.items.map((t, i) => (
                          <Draggable key={t.id} draggableId={String(t.id)} index={i} isDragDisabled={!canEdit(t)}>
                            {(p, s) => (
                              <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} style={p.draggableProps.style} className={cn(s.isDragging && 'rotate-1 opacity-95')}>
                                <TaskCard task={t} people={people} showAssignee={team} onOpen={openEdit} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {prov.placeholder}
                        {col.items.length === 0 && !snap.isDraggingOver && (
                          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-8 text-xs text-slate-600">
                            <ClipboardList className="h-5 w-5 text-slate-500" />No tasks here
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </section>
              ))}
            </div>
          </DragDropContext>
          <aside className="w-full xl:w-[320px] xl:flex-none">
            {team ? <TeamPanel tasks={tasks} people={people} /> : <MyPanel tasks={myTasks} me={me} isAdmin={isAdmin} />}
          </aside>
        </div>
      )}

      <TaskDialog
        open={dialog.open} task={dialog.task} defaults={dialog.defaults} people={people} saving={saving}
        canDelete={!dialog.task || canEdit(dialog.task)} onClose={closeDialog} onSave={save} onDelete={remove}
      />
    </div>
  );
}