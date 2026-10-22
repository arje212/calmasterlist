// src/api/reportFiles.js  --  calls the attachment routes of reportEngine.js
//
//   GET    /api/reports/:id/attachments                 -> [{ id, file, caption, annotations, slot, size, ... }]
//   POST   /api/reports/:id/attachments                 raw JPEG/PNG body, headers x-caption (URI-encoded), x-slot (optional)
//   PUT    /api/reports/:id/attachments/:attId          { caption, annotations }
//   DELETE /api/reports/:id/attachments/:attId
//   GET    /api/reports/:id/attachments/:attId/file     the image
//
// ADAPT HERE (only place): if src/api/apiClient.js sends an Authorization header / uses another base URL,
// make `authHeaders()` and `baseUrl()` return the same thing.  Cookie sessions work as they are (credentials: 'include').
import { apiClient } from '@/api/apiClient';

const baseUrl = () => String(apiClient?.baseUrl || apiClient?.baseURL || '').replace(/\/$/, '');

function authHeaders() {
  const headers = {};
  try {
    const fromClient = typeof apiClient?.getToken === 'function' ? apiClient.getToken() : null;
    const token = fromClient || ['token', 'auth_token', 'access_token', 'authToken'].map((k) => window.localStorage.getItem(k)).find(Boolean);
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* no storage / no token: rely on cookies */ }
  return headers;
}

async function request(path, { method = 'GET', body, headers } = {}) {
  const response = await fetch(`${baseUrl()}${path}`, { method, body, credentials: 'include', headers: { ...authHeaders(), ...headers } });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const data = await response.json(); if (data?.error) message = data.error; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return response;
}

export const listAttachments = async (reportId) => (await request(`/api/reports/${reportId}/attachments`)).json();

export const uploadAttachment = async (reportId, blob, { caption = '', slot } = {}) =>
  (await request(`/api/reports/${reportId}/attachments`, {
    method: 'POST', body: blob,
    headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-caption': encodeURIComponent(caption), ...(slot ? { 'x-slot': slot } : {}) },
  })).json();

export const saveAttachment = async (reportId, attId, patch) =>
  (await request(`/api/reports/${reportId}/attachments/${attId}`, {
    method: 'PUT', body: JSON.stringify(patch), headers: { 'Content-Type': 'application/json' },
  })).json();

export const deleteAttachment = async (reportId, attId) =>
  (await request(`/api/reports/${reportId}/attachments/${attId}`, { method: 'DELETE' })).json();

/** <img src> cannot send an Authorization header, so the image is fetched and shown through a blob: URL */
export const loadImageUrl = async (reportId, attId) =>
  URL.createObjectURL(await (await request(`/api/reports/${reportId}/attachments/${attId}/file`)).blob());
