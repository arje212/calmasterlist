// server/taskBoard.js
// Task board: /api/entities/Task at /api/people. Sinusunod ang pattern ng reportEngine.js.
import { format, isValid, parseISO } from 'date-fns';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const PRIORITIES = ['high', 'medium', 'low'];
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Tinatanggap lang ang mga field na ito. Ang created_by_* at completed_at ay sa server lang itinatakda.
function parseTask(input, users, { creating }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Invalid task' };
  const out = {};
  if (creating || Object.hasOwn(input, 'title')) {
    const title = String(input.title ?? '').trim();
    if (!title || title.length > 200) return { error: 'Enter a task title (maximum 200 characters)' };
    out.title = title;
  }
  if (Object.hasOwn(input, 'description')) {
    const description = String(input.description ?? '').trim();
    if (description.length > 2000) return { error: 'Description is too long (maximum 2000 characters)' };
    out.description = description;
  }
  if (Object.hasOwn(input, 'status')) {
    if (!STATUSES.includes(input.status)) return { error: 'Invalid task status' };
    out.status = input.status;
  } else if (Object.hasOwn(input, 'done')) {
    out.status = input.done ? 'done' : 'todo'; // para sa lumang client na "done" lang ang alam
  }
  if (Object.hasOwn(input, 'priority')) {
    if (!PRIORITIES.includes(input.priority)) return { error: 'Invalid priority' };
    out.priority = input.priority;
  }
  if (Object.hasOwn(input, 'progress')) {
    const n = Number(input.progress);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: 'Progress must be between 0 and 100' };
    out.progress = Math.round(n);
  }
  if (Object.hasOwn(input, 'due_date')) {
    const text = String(input.due_date ?? '').trim();
    if (!text) out.due_date = null;
    else {
      const parsed = parseISO(text);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== text) return { error: 'Due date must be a valid date' };
      out.due_date = text;
    }
  }
  if (Object.hasOwn(input, 'assignee_email')) {
    const email = String(input.assignee_email ?? '').trim();
    if (!email) out.assignee_email = null;
    else {
      const user = users.find((entry) => !entry.disabled && same(entry.email, email));
      if (!user) return { error: 'The assigned person was not found' };
      out.assignee_email = user.email;
    }
  }
  return { values: out };
}

export function createTaskBoard({ listEntity, createEntity, updateEntity, deleteEntity, send, body, isAdmin }) {
  // Puwedeng mag-edit/magbura: admin, ang gumawa, o ang may hawak
  const canChange = (actor, task) =>
    isAdmin(actor) || task.created_by_id === actor.id || same(task.created_by_email, actor.email) || same(task.assignee_email, actor.email);
  const reply = (response, status, payload) => { send(response, status, payload); return true; };

  return {
    // Ibinabalik ang true kapag ang request ay hawak na ng module na ito
    async handle(request, response, pathname, actor) {
      // Listahan ng tao para sa "Assigned to" at Team board: abot ng lahat ng naka-login, walang password o signature
      if (pathname === '/api/people' && request.method === 'GET') {
        const users = (await listEntity('User')).filter((user) => !user.disabled);
        return reply(response, 200, users.map((user) => ({ id: user.id, email: user.email, full_name: user.full_name || user.username || user.email })));
      }

      const match = pathname.match(/^\/api\/entities\/Task(?:\/([^/]+))?$/);
      if (!match) return false;
      const rowId = match[1] ? decodeURIComponent(match[1]) : null;

      if (!rowId && request.method === 'GET') return reply(response, 200, await listEntity('Task'));

      if (!rowId && request.method === 'POST') {
        const parsed = parseTask(await body(request), await listEntity('User'), { creating: true });
        if (parsed.error) return reply(response, 400, { error: parsed.error });
        const v = parsed.values;
        const status = v.status || 'todo';
        const created = await createEntity('Task', {
          description: '', priority: 'medium', due_date: null, ...v,
          status, done: status === 'done',
          progress: status === 'done' ? 100 : (v.progress ?? 0),
          completed_at: status === 'done' ? new Date().toISOString() : null,
          assignee_email: Object.hasOwn(v, 'assignee_email') ? v.assignee_email : actor.email,
          created_by_id: actor.id, created_by_email: actor.email, created_by_name: actor.full_name || actor.email,
        });
        return reply(response, 201, created);
      }

      if (rowId && (request.method === 'PUT' || request.method === 'DELETE')) {
        const current = (await listEntity('Task')).find((task) => task.id === rowId);
        if (!current) return reply(response, 404, { error: 'Task not found' });
        if (!canChange(actor, current)) return reply(response, 403, { error: 'Only the owner, the assignee, or an admin can change this task' });
        if (request.method === 'DELETE') return reply(response, 200, await deleteEntity('Task', rowId));

        const parsed = parseTask(await body(request), await listEntity('User'), { creating: false });
        if (parsed.error) return reply(response, 400, { error: parsed.error });
        const next = { ...parsed.values };
        if (next.status) {
          next.done = next.status === 'done';
          next.completed_at = next.done ? (current.completed_at || new Date().toISOString()) : null;
          if (next.done) next.progress = 100;
        }
        return reply(response, 200, await updateEntity('Task', rowId, next));
      }

      return reply(response, 405, { error: 'Method not allowed' });
    },
  };
}
