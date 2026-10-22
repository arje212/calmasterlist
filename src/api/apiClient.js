// @ts-nocheck
import { appParams } from '@/lib/app-params';

const tokenKey = 'token';
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function authHeaders(headers = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(tokenKey) : null;
  return { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: authHeaders(options.headers) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return result;
}
// For PDF / xlsx / images. <iframe> and <img> cannot send the Bearer token, so we fetch a blob and use an object URL.
async function requestBlob(url, options = {}) {
  const response = await fetch(url, { ...options, headers: authHeaders(options.headers) });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const error = new Error(result.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.blob();
}
function sortRows(rows, sort) { const field = String(sort || '').replace(/^-/, ''); const direction = String(sort || '').startsWith('-') ? -1 : 1; return [...rows].sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? ''), undefined, { numeric: true }) * direction); }
function remoteEntity(name) {
  const url = `/api/entities/${name}`;
  return {
    async list(sort, limit = 100) {
      const rows = await requestJson(url);
      return sortRows(Array.isArray(rows) ? rows : [], sort).slice(0, limit);
    },
    async filter(filters = {}, sort, limit = 100) {
      const rows = await requestJson(url);
      const filtered = (Array.isArray(rows) ? rows : []).filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
      return sortRows(filtered, sort).slice(0, limit);
    },
    async create(values) {
      return requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    },
    async update(rowId, values) {
      return requestJson(`${url}/${rowId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    },
    async delete(rowId) {
      return requestJson(`${url}/${rowId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    },
  };
}
function sqliteEquipment() {
  const remote = async () => requestJson('/api/equipment');
  const request = async (url, method, values) => requestJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
  return {
    async list(sort, limit = 100) { return (await remote()).slice(0, limit); },
    async filter(filters = {}, sort, limit = 100) { return (await remote()).filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value)).slice(0, limit); },
    async create(values) { return request('/api/equipment', 'POST', values); },
    async update(rowId, values) { return request(`/api/equipment/${rowId}`, 'PUT', values); },
    async delete(rowId) { return request(`/api/equipment/${rowId}`, 'DELETE', {}); },
  };
}
function standardEquipment() {
  const remote = async () => requestJson('/api/standard-equipment');
  return {
    async list() { return remote(); },
    async create(values) { return requestJson('/api/standard-equipment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); },
  };
}
function setSession(session) { window.localStorage.setItem(tokenKey, session.token); window.localStorage.setItem('calibratrack_user', session.user.id); appParams.token = session.token; return session.user; }
export const apiClient = {
  app: { async getPublicSettings() { return { id: appParams.appId, public_settings: {} }; } },
  externalCalibrations: {
    async list() { return requestJson('/api/external-calibrations'); },
    async create(values) { return requestJson('/api/external-calibrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); },
    async update(recordId, values) { return requestJson(`/api/external-calibrations/${recordId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); },
    async review(recordId, decision, remarks = '') { return requestJson(`/api/external-calibrations/${recordId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, remarks }) }); },
    async uploadCertificate(recordId, file) { return requestJson(`/api/external-calibrations/${recordId}/certificate`, { method: 'POST', body: file, headers: { 'Content-Type': file.type, 'x-file-name': encodeURIComponent(file.name) } }); },
    certificate(recordId) { return requestBlob(`/api/external-calibrations/${recordId}/certificate`); },
  },
  auth: {
    async status() { return requestJson('/api/auth/status'); },
    async me() { return requestJson('/api/auth/me'); },
    async loginViaEmailPassword(identifier, password) {
      const session = await requestJson('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_number: String(identifier ?? '').trim(), password }) });
      return setSession(session);
    },
    loginWithProvider() { throw new Error('External sign-in is not configured'); },
    async logout(redirect) { try { await requestJson('/api/auth/logout', { method: 'POST' }); } catch { /* clear expired sessions locally */ } window.localStorage.removeItem(tokenKey); window.localStorage.removeItem('calibratrack_user'); appParams.token = null; if (redirect) window.location.href = redirect; },
    redirectToLogin(returnTo = '/') {
      let destination = '/';
      try {
        const candidate = new URL(returnTo, window.location.origin);
        const authPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
        if (candidate.origin === window.location.origin && !authPaths.includes(candidate.pathname)) {
          destination = `${candidate.pathname}${candidate.search}${candidate.hash}`;
        }
      } catch {
        destination = '/';
      }
      window.location.replace(`/login${destination !== '/' ? `?returnTo=${encodeURIComponent(destination)}` : ''}`);
    },
    async register() { throw new Error('Ask an administrator to create your account'); },
    async changePassword(currentPassword, newPassword) { return requestJson('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }); },
  },
  users: {
    async inviteUser(idNumber, role, password) { const username = String(idNumber ?? '').trim(); if (!username) throw new Error('ID number is required'); return apiClient.entities.User.create({ id_number: username, username, email: `${username}@local.test`, full_name: username, role: role || 'user', password, disabled: false }); },
    async resetPassword(userId, password) { return requestJson(`/api/entities/User/${userId}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); },
  },
  // Excel-template reports: PDF preview / frozen approved copy, xlsx download, photo attachments
  reports: {
    templates: () => requestJson('/api/report-templates'),
    pdf: (reportId) => requestBlob(`/api/reports/${reportId}/pdf`),   // frozen file when approved, live preview otherwise
    xlsx: (reportId) => requestBlob(`/api/reports/${reportId}/xlsx`),
    attachments: {
      list: (reportId) => requestJson(`/api/reports/${reportId}/attachments`),
      upload: (reportId, file, caption = '', slot) => requestJson(`/api/reports/${reportId}/attachments`, {
        method: 'POST',
        body: file,
        headers: { 'x-caption': encodeURIComponent(caption), ...(slot ? { 'x-slot': slot } : {}) },
      }),
      update: (reportId, attId, values) => requestJson(`/api/reports/${reportId}/attachments/${attId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }),
      remove: (reportId, attId) => requestJson(`/api/reports/${reportId}/attachments/${attId}`, { method: 'DELETE' }),
      image: (reportId, attId) => requestBlob(`/api/reports/${reportId}/attachments/${attId}/file`),
    },
  },
  entities: { AppSettings: remoteEntity('AppSettings'), Equipment: sqliteEquipment(), StandardEquipment: standardEquipment(), VerificationRecord: remoteEntity('VerificationRecord'), Report: remoteEntity('Report'), AuditLog: remoteEntity('AuditLog'), User: remoteEntity('User') },
  integrations: { Core: { async UploadPrivateFile({ file }) { return { file_uri: `local-file://${id()}-${encodeURIComponent(file.name)}` }; }, async UploadPublicFile({ file }) { return { file_url: URL.createObjectURL(file) }; }, async CreateFileSignedUrl({ file_uri }) { return { signed_url: file_uri }; } } },
};