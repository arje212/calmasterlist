// src/lib/tasksApi.js
// Ginagamit ang totoong Task entity ng apiClient kapag mayroon. Kung wala pa, pansamantalang
// nase-save ang mga task sa browser na ito (localStorage) para gumana pa rin ang page.
import { apiClient } from '@/api/apiClient';

const KEY = 'calibratrack.tasks.local.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (rows) => localStorage.setItem(KEY, JSON.stringify(rows));
const now = () => new Date().toISOString();

const local = {
  async list(sort = '-created_date', limit = 500) {
    const desc = String(sort).startsWith('-');
    const key = String(sort).replace(/^-/, '');
    const rows = read().sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')) * (desc ? -1 : 1));
    return rows.slice(0, limit);
  },
  async create(data) {
    const row = { ...data, id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_date: now() };
    write([row, ...read()]);
    return row;
  },
  async update(id, patch) {
    const rows = read().map((r) => (r.id === id ? { ...r, ...patch, updated_date: now() } : r));
    write(rows);
    return rows.find((r) => r.id === id);
  },
  async delete(id) {
    write(read().filter((r) => r.id !== id));
    return { id };
  },
};

const remote = () => apiClient?.entities?.Task || null;

// True kung wala pang Task entity sa apiClient/server
export const usingLocalTasks = () => !remote();

export const taskApi = new Proxy({}, {
  get(_, name) {
    const target = remote() || local;
    const value = target[name];
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

// Ililipat sa server ang mga task na naka-save sa browser na ito (isang beses). Ang mga hindi tinanggap ay mananatili rito.
export async function migrateLocalTasks() {
  const target = remote();
  const rows = read();
  if (!target || rows.length === 0) return 0;
  const left = [];
  let moved = 0;
  for (const row of rows.slice().reverse()) { // pinakaluma muna
    const { id, created_date, updated_date, completed_at, ...rest } = row; // eslint-disable-line no-unused-vars
    try { await target.create(rest); moved += 1; } catch { left.push(row); }
  }
  write(left.reverse());
  return moved;
}
