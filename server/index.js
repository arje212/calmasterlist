import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';
import XLSX from 'xlsx';
import { addMonths, format, isValid, parseISO, subDays } from 'date-fns';
import { createReportEngine } from './reportEngine.js'; // [report-engine]

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');
const workbookPath = path.join(projectRoot, 'CalibrationMasterlist_with_Dashboard.xlsm');
const standardWorkbookPath = path.join(projectRoot, 'Standard Equipment Details.xlsx');
const dbPath = process.env.CALIBRATRACK_DB || path.join(projectRoot, 'calibratrack.sqlite');
const externalCalibrationFiles = path.join(process.env.REPORT_DATA_DIR || path.join(projectRoot, 'report-data'), 'external-calibrations');
const db = new sqlite3.Database(dbPath);
const scrypt = (password, salt) => new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (error) { error ? reject(error) : resolve(this); }));
const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
function readUpload(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { tooLarge = true; chunks.length = 0; }
      else if (!tooLarge) chunks.push(chunk);
    });
    request.on('end', () => tooLarge ? reject(Object.assign(new Error('Certificate must be 10 MB or smaller'), { status: 413 })) : resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}
const clean = (value) => String(value ?? '').trim();
const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

async function ensureSharedEntityStore() {
  await run(`CREATE TABLE IF NOT EXISTS entity_store (entity_name TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, created_date TEXT, updated_date TEXT, PRIMARY KEY(entity_name, id))`);
  await run(`CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)`);
}

async function listEntity(name) {
  const rows = await all('SELECT payload FROM entity_store WHERE entity_name = ? ORDER BY created_date ASC, id ASC', [name]);
  return rows.map((row) => JSON.parse(row.payload));
}

async function createEntity(name, values) {
  const now = new Date().toISOString();
  const row = { ...values, id: values.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, created_date: values.created_date || now, updated_date: values.updated_date || now };
  await run('INSERT INTO entity_store (entity_name, id, payload, created_date, updated_date) VALUES (?, ?, ?, ?, ?)', [name, row.id, JSON.stringify(row), row.created_date, row.updated_date]);
  return row;
}

async function updateEntity(name, rowId, values) {
  const existing = await get('SELECT payload FROM entity_store WHERE entity_name = ? AND id = ?', [name, rowId]);
  if (!existing) return null;
  const current = JSON.parse(existing.payload);
  const updated = { ...current, ...values, id: rowId, updated_date: new Date().toISOString() };
  await run('UPDATE entity_store SET payload = ?, updated_date = ? WHERE entity_name = ? AND id = ?', [JSON.stringify(updated), updated.updated_date, name, rowId]);
  return updated;
}

async function deleteEntity(name, rowId) {
  await run('DELETE FROM entity_store WHERE entity_name = ? AND id = ?', [name, rowId]);
  return { id: rowId };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return scrypt(password, salt).then((key) => `${salt}:${key.toString('hex')}`);
}
async function verifyPassword(password, stored) {
  const [salt, digest] = String(stored || '').split(':');
  if (!salt || !digest) return false;
  const actual = await scrypt(password, salt);
  const expected = Buffer.from(digest, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
function publicUser(user) {
  const { password_hash, signature_data, ...safe } = user;
  return { ...safe, has_signature: Boolean(signature_data) };
}
async function createSession(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await run('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', [tokenHash, user.id, expiresAt]);
  return { token, user: publicUser(user) };
}
async function authenticatedUser(request) {
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await get('SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > ?', [tokenHash, new Date().toISOString()]);
  if (!session) return null;
  const row = await get('SELECT payload FROM entity_store WHERE entity_name = ? AND id = ?', ['User', session.user_id]);
  if (!row) return null;
  const user = JSON.parse(row.payload);
  return user.disabled ? null : user;
}
function isAdmin(user) { return user?.role === 'admin'; }
function unauthorized(response) { return send(response, 401, { error: 'Authentication required' }); }
function forbidden(response) { return send(response, 403, { error: 'Insufficient permissions' }); }
function validPassword(password) { return typeof password === 'string' && password.length > 0 && password.length <= 256; }

function headerIndex(rows) {
  return rows.findIndex((row) => row.some((cell) => clean(cell) === 'No.') && row.some((cell) => /Equipment Type/i.test(clean(cell))));
}
function uniqueHeaders(header) {
  const seen = {};
  return header.map((cell, index) => {
    const base = slug(cell) || `column_${index + 1}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] === 1 ? base : `${base}_${seen[base]}`;
  });
}
function value(row, names) { const key = Object.keys(row).find((name) => names.some((part) => name.includes(part))); return key ? clean(row[key]) : ''; }
function controlCode(row) {
  const keys = Object.keys(row);
  const start = keys.findIndex((key) => ['nikkoshi_control_no', 'nikkoshi'].includes(key));
  const end = keys.indexOf('equipment_type');
  if (start < 0) return '';
  return keys.slice(start, end > start ? end : start + 1).map((key) => clean(row[key])).filter(Boolean).join('').replace(/\s+/g, '');
}
function excelDate(value) {
  const text = clean(value);
  const match = text.match(/^(\d{1,2})[-\/]([A-Za-z]{3,9})[-\/](\d{2,4})$/);
  if (!match) return text;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  const date = new Date(`${match[1]} ${match[2]} ${year} 00:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString().slice(0, 10);
}
function normalizedRow(row, sheet, sourceRow) {
  const code = controlCode(row) || value(row, ['nikkoshi_control_no', 'nikkoshi']) || `${slug(sheet)}-${sourceRow}`;
  const name = value(row, ['equipment_type']) || 'Unspecified Equipment';
  const status = value(row, ['status']).toLowerCase();
  const checkingDate = excelDate(value(row, ['checking_date']));
  const dueDate = excelDate(value(row, ['checking_due']));
  const result = status.includes('pass') ? 'pass' : status.includes('partial') ? 'partial' : status.includes('fail') ? 'failed' : '';
  return {
    id: `excel-${slug(sheet)}-${sourceRow}`,
    equipment_code: code,
    equipment_name: name,
    description: value(row, ['range']),
    category: name,
    manufacturer: value(row, ['maker']),
    model: value(row, ['model']),
    serial_number: value(row, ['serial_no']),
    accuracy: value(row, ['equipment_accuracy']) || clean(row.equipment),
    required_accuracy: value(row, ['required_accuracy']) || clean(row.required) || clean(row.column_13) || clean(row.column_12),
    location: value(row, ['specific_location', 'location']),
    department: sheet,
    calibration_type: value(row, ['checking_type']) || 'Calibration',
    frequency_months: 12,
    last_verification_date: checkingDate,
    next_due_date: dueDate,
    last_result: result,
    certificate_number: value(row, ['calibration_report']),
    remarks: value(row, ['remarks']),
    deleted: false,
    source_sheet: sheet,
    source_row: sourceRow,
    excel_data: row,
  };
}
async function importWorkbook() {
  await run(`CREATE TABLE IF NOT EXISTS equipment (id TEXT PRIMARY KEY, equipment_code TEXT, equipment_name TEXT, department TEXT, location TEXT, next_due_date TEXT, source_sheet TEXT, source_row INTEGER, payload TEXT NOT NULL, imported_at TEXT NOT NULL)`);
  if (!fs.existsSync(workbookPath)) return;
  const workbook = XLSX.readFile(workbookPath, { cellDates: false, raw: false });
  for (const sheet of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: '', raw: false });
    const index = headerIndex(rows);
    if (index < 0) continue;
    const headers = uniqueHeaders(rows[index]);
    for (let i = index + 1; i < rows.length; i += 1) {
      const values = rows[i];
      if (!values.some((item) => clean(item))) continue;
      const source = Object.fromEntries(headers.map((key, column) => [key, clean(values[column])]).filter(([, value]) => value));
      if (!Object.values(source).some(Boolean)) continue;
      const equipmentType = value(source, ['equipment_type']);
      if (!equipmentType || equipmentType.toLowerCase() === 'equipment type') {
        const stale = await get('SELECT payload FROM equipment WHERE id = ?', [`excel-${slug(sheet)}-${i + 1}`]);
        if (stale) {
          const saved = JSON.parse(stale.payload);
          if (saved.equipment_name === 'Unspecified Equipment' && saved.equipment_code === 'ControlNo.') {
            await run('DELETE FROM equipment WHERE id = ?', [saved.id]);
          }
        }
        continue;
      }
      const item = normalizedRow(source, sheet, i + 1);
      const existing = await get('SELECT payload FROM equipment WHERE id = ?', [item.id]);
      if (existing) {
        const current = JSON.parse(existing.payload);
        const oldPrefix = controlCode(current.excel_data || {}) || value(current.excel_data || {}, ['nikkoshi_control_no', 'nikkoshi']);
        const saved = {
          ...current,
          ...item,
          equipment_code: current.equipment_code === oldPrefix ? item.equipment_code : current.equipment_code,
          deleted: current.deleted ?? item.deleted,
          excel_data: item.excel_data,
        };
        await run('UPDATE equipment SET equipment_code=?,equipment_name=?,department=?,location=?,next_due_date=?,source_sheet=?,source_row=?,payload=?,imported_at=? WHERE id=?', [saved.equipment_code || '', saved.equipment_name || '', saved.department || '', saved.location || '', saved.next_due_date || '', saved.source_sheet || '', saved.source_row || null, JSON.stringify(saved), new Date().toISOString(), item.id]);
      } else {
        await run('INSERT INTO equipment (id,equipment_code,equipment_name,department,location,next_due_date,source_sheet,source_row,payload,imported_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [item.id, item.equipment_code, item.equipment_name, item.department, item.location, item.next_due_date, item.source_sheet, item.source_row, JSON.stringify(item), new Date().toISOString()]);
      }
    }
  }
  console.log(`SQLite import complete: ${(await get('SELECT COUNT(*) AS count FROM equipment')).count} equipment rows`);
}
function standardWorkbookRows() {
  if (!fs.existsSync(standardWorkbookPath)) return [];
  const workbook = XLSX.readFile(standardWorkbookPath, { cellDates: false, raw: false });
  const sheet = workbook.Sheets.MME_ALL;
  if (!sheet) return [];
  const cells = Object.keys(sheet).filter((key) => !key.startsWith('!'));
  const lastRow = Math.max(...cells.map((key) => Number(key.match(/\d+$/)?.[0] || 0)));
  const cell = (column, row) => clean(sheet[`${column}${row}`]?.v);
  const rows = [];
  for (let row = 6; row <= lastRow; row += 1) {
    const controlNumber = `${cell('C', row)}${cell('D', row)}${cell('E', row)}`;
    if (!controlNumber || !cell('F', row)) continue;
    rows.push({ id: `standard-${slug(controlNumber)}`, control_number: controlNumber, equipment_type: cell('F', row), maker_model: [cell('G', row), cell('H', row)].filter(Boolean).join(' / '), maker: cell('G', row), model: cell('H', row), serial_number: cell('I', row), accuracy: cell('J', row), calibrated_by: cell('K', row), traceability: cell('L', row), certificate_number: cell('M', row), range: cell('Q', row), required_accuracy: cell('R', row), location: cell('S', row), application_limit: cell('V', row), source_row: row });
  }
  return rows;
}
async function standardRows() {
  const workbookRows = standardWorkbookRows();
  const addedRows = await listEntity('StandardEquipment');
  return [...workbookRows, ...addedRows.filter((row) => !row.deleted)];
}
function send(response, status, body) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(body)); }
function body(request) { return new Promise((resolve, reject) => { let raw = ''; request.on('data', (chunk) => { raw += chunk; }); request.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); } }); }); }

// ---- [report-engine] -------------------------------------------------------------------------------------------
// Excel-template reports (PDF preview, photo attachments, frozen approved copy).  Files live in ../report-data
const engine = createReportEngine({
  listEntity,
  updateEntity,
  send,
  isAdmin,
  getEquipment: async (id) => {
    const row = await get('SELECT payload FROM equipment WHERE id = ?', [id]);
    return row ? JSON.parse(row.payload) : null;
  },
});
// fields only the server may write - a browser can never set these through the generic PUT/POST
const SERVER_OWNED_REPORT_FIELDS = ['attachments', 'final_xlsx_path', 'final_pdf_path', 'final_xlsx_sha256', 'final_pdf_sha256', 'finalized_at', 'template_key'];
// Report numbers are assigned on the server, because a normal user only sees their own reports in the browser
let reportLane = Promise.resolve();
const serialized = (job) => { const next = reportLane.then(job, job); reportLane = next.catch(() => {}); return next; };
function uniqueReportNumber(existingReports, wanted) {
  const used = new Set(existingReports.map((report) => report.report_number));
  const base = clean(wanted) || `VR-${new Date().getFullYear()}-0001`;
  const match = base.match(/^(.*?)(\d+)$/);
  const prefix = match ? match[1] : `${base}-`;
  const width = match ? match[2].length : 4;
  let counter = match ? Number(match[2]) : 0;
  let candidate = base;
  while (used.has(candidate)) { counter += 1; candidate = `${prefix}${String(counter).padStart(width, '0')}`; }
  return candidate;
}
// ---------------------------------------------------------------------------------------------------------------

async function handler(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-caption, x-slot', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' }); return response.end(); }
  const publicAuthRoute = pathname === '/api/auth/status' || pathname === '/api/auth/login';
  const actor = pathname.startsWith('/api/') && !publicAuthRoute ? await authenticatedUser(request) : null;
  if (pathname.startsWith('/api/') && !publicAuthRoute && !actor) return unauthorized(response);
  if (actor && await engine.handle(request, response, pathname, actor)) return; // [report-engine] templates, PDF/xlsx, attachments
  if (pathname === '/api/auth/status' && request.method === 'GET') {
    const users = await listEntity('User');
    return send(response, 200, { setup_required: !users.some((user) => user.role === 'admin' && user.password_hash) });
  }
  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const item = await body(request);
    const identifier = String(item.id_number || '').trim().toLowerCase();
    const password = String(item.password || '');
    if (!identifier || !password) return send(response, 400, { error: 'Enter your ID number and password' });
    const users = await listEntity('User');
    let user = users.find((entry) => [entry.id_number, entry.username, entry.email, entry.id_number === '1863' ? 'admin@local.test' : ''].some((value) => String(value || '').trim().toLowerCase() === identifier));
    const adminExists = users.some((entry) => entry.role === 'admin' && entry.password_hash);
    if (!adminExists && identifier === '1863') {
      const existing = user;
      const profile = { id_number: '1863', username: '1863', email: existing?.email || '1863@local.test', full_name: existing?.full_name || '1863', role: 'admin', disabled: false, password_hash: await hashPassword(password) };
      user = existing ? await updateEntity('User', existing.id, profile) : await createEntity('User', profile);
    } else if (!user || user.disabled || !(await verifyPassword(password, user.password_hash))) {
      return send(response, 401, { error: 'Invalid ID number or password' });
    }
    return send(response, 200, await createSession(user));
  }
  if (pathname === '/api/auth/me' && request.method === 'GET') return send(response, 200, publicUser(actor));
  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (token) await run('DELETE FROM auth_sessions WHERE token_hash = ?', [crypto.createHash('sha256').update(token).digest('hex')]);
    return send(response, 200, { ok: true });
  }
  if (pathname === '/api/auth/change-password' && request.method === 'POST') {
    const item = await body(request);
    if (!validPassword(item.new_password)) return send(response, 400, { error: 'Enter a password (maximum 256 characters)' });
    if (!(await verifyPassword(String(item.current_password || ''), actor.password_hash))) return send(response, 400, { error: 'Current password is incorrect' });
    const updated = await updateEntity('User', actor.id, { password_hash: await hashPassword(item.new_password) });
    await run('DELETE FROM auth_sessions WHERE user_id = ? AND token_hash != ?', [actor.id, crypto.createHash('sha256').update(request.headers.authorization.match(/^Bearer\s+(.+)$/i)[1]).digest('hex')]);
    return send(response, 200, publicUser(updated));
  }
  const resetPasswordMatch = pathname.match(/^\/api\/entities\/User\/([^/]+)\/reset-password$/);
  if (resetPasswordMatch && request.method === 'POST') {
    if (!isAdmin(actor)) return forbidden(response);
    const item = await body(request);
    if (!validPassword(item.password)) return send(response, 400, { error: 'Enter a temporary password (maximum 256 characters)' });
    const updated = await updateEntity('User', resetPasswordMatch[1], { password_hash: await hashPassword(item.password) });
    if (!updated) return send(response, 404, { error: 'User not found' });
    await run('DELETE FROM auth_sessions WHERE user_id = ?', [resetPasswordMatch[1]]);
    return send(response, 200, publicUser(updated));
  }
  if (pathname === '/api/external-calibrations' && request.method === 'GET') {
    return send(response, 200, await listEntity('ExternalCalibration'));
  }
  if (pathname === '/api/external-calibrations' && request.method === 'POST') {
    if (!['admin', 'user', 'sr_staff'].includes(actor.role)) return forbidden(response);
    const item = await body(request);
    const equipmentRow = await get('SELECT payload FROM equipment WHERE id = ?', [String(item.equipment_id || '')]);
    if (!equipmentRow) return send(response, 404, { error: 'Equipment not found' });
    const equipment = JSON.parse(equipmentRow.payload);
    if (String(equipment.calibration_type || '').toLowerCase() !== 'external provider calibration') return send(response, 400, { error: 'Equipment is not scheduled for external provider calibration' });
    const existing = (await listEntity('ExternalCalibration')).find((cycle) => cycle.equipment_id === equipment.id && cycle.status !== 'completed');
    if (existing) return send(response, 409, { error: 'An external calibration cycle is already in progress for this equipment' });
    const provider = clean(item.provider);
    if (!provider) return send(response, 400, { error: 'External provider is required' });
    const record = await createEntity('ExternalCalibration', {
      equipment_id: equipment.id, equipment_code: equipment.equipment_code, equipment_name: equipment.equipment_name,
      provider, target_send_date: clean(item.target_send_date), pr_number: clean(item.pr_number), po_number: clean(item.po_number),
      status: 'planned', certificate_review_status: 'pending', created_by_id: actor.id, created_by_name: actor.full_name || actor.email,
    });
    return send(response, 201, record);
  }
  const externalCertificate = pathname.match(/^\/api\/external-calibrations\/([^/]+)\/certificate$/);
  if (externalCertificate) {
    const cycle = (await listEntity('ExternalCalibration')).find((entry) => entry.id === externalCertificate[1]);
    if (!cycle) return send(response, 404, { error: 'External calibration not found' });
    if (request.method === 'GET') {
      const certificate = cycle.certificate_file;
      if (!certificate?.file) return send(response, 404, { error: 'Certificate not uploaded' });
      const filePath = path.join(externalCalibrationFiles, cycle.id, certificate.file);
      if (!fs.existsSync(filePath)) return send(response, 404, { error: 'Certificate file not found' });
      response.writeHead(200, { 'Content-Type': certificate.mime_type, 'Content-Length': fs.statSync(filePath).size, 'Content-Disposition': `inline; filename="${certificate.original_name}"`, 'Cache-Control': 'private, no-store' });
      fs.createReadStream(filePath).pipe(response);
      return;
    }
    if (request.method === 'POST') {
      if (!['admin', 'user', 'sr_staff', 'qa_manager'].includes(actor.role)) return forbidden(response);
      if (cycle.status !== 'returned') return send(response, 409, { error: 'Upload the certificate after the equipment has been returned' });
      const mime = String(request.headers['content-type'] || '').split(';')[0].toLowerCase();
      const extensions = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
      if (!extensions[mime]) return send(response, 400, { error: 'Only PDF, JPG, or PNG certificates are allowed' });
      let file;
      try { file = await readUpload(request, 10 * 1024 * 1024); }
      catch (error) { return send(response, error.status || 400, { error: error.message || 'Could not read certificate' }); }
      const validSignature = mime === 'application/pdf' ? file.subarray(0, 5).toString() === '%PDF-'
        : mime === 'image/png' ? file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : file.length > 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
      if (!validSignature) return send(response, 400, { error: 'The uploaded file does not match its PDF or image type' });
      const fileName = `${crypto.randomUUID()}.${extensions[mime]}`;
      const folder = path.join(externalCalibrationFiles, cycle.id);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, fileName), file, { flag: 'wx' });
      let headerName = String(request.headers['x-file-name'] || `certificate.${extensions[mime]}`);
      try { headerName = decodeURIComponent(headerName); } catch { /* fall back to sanitizing the encoded name */ }
      const originalName = path.basename(headerName).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120);
      const updated = await updateEntity('ExternalCalibration', cycle.id, { certificate_file: { file: fileName, original_name: originalName || `certificate.${extensions[mime]}`, mime_type: mime, size: file.length, uploaded_by: actor.full_name || actor.email, uploaded_at: new Date().toISOString() } });
      if (cycle.certificate_file?.file) fs.rmSync(path.join(folder, cycle.certificate_file.file), { force: true });
      return send(response, 201, updated.certificate_file);
    }
  }
  const externalCycle = pathname.match(/^\/api\/external-calibrations\/([^/]+)$/);
  if (externalCycle && request.method === 'PUT') {
    if (!['admin', 'user', 'sr_staff'].includes(actor.role)) return forbidden(response);
    const cycle = (await listEntity('ExternalCalibration')).find((entry) => entry.id === externalCycle[1]);
    if (!cycle) return send(response, 404, { error: 'External calibration not found' });
    if (cycle.status === 'completed') return send(response, 409, { error: 'Completed external calibration cycles are locked' });
    const input = await body(request);
    const fields = ['provider', 'target_send_date', 'pr_number', 'po_number', 'status', 'sent_date', 'initial_physical_condition', 'initial_functional_condition', 'issued_by', 'approved_by', 'provider_received_by', 'returned_date', 'returned_physical_condition', 'returned_functional_condition', 'returned_by_provider', 'received_by', 'return_approved_by', 'calibration_date', 'calibration_result', 'certificate_number', 'remarks'];
    const changes = Object.fromEntries(Object.entries(input).filter(([key]) => fields.includes(key)).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    const nextStatus = changes.status || cycle.status;
    const validTransitions = { planned: ['planned', 'sent'], sent: ['sent', 'returned'], returned: ['returned'] };
    if (!validTransitions[cycle.status]?.includes(nextStatus)) return send(response, 400, { error: 'Invalid external calibration status transition' });
    if (changes.calibration_result && !['pass', 'partial', 'conditional', 'failed'].includes(changes.calibration_result)) return send(response, 400, { error: 'Invalid calibration result' });
    const nextField = (field) => changes[field] || cycle[field];
    if (nextStatus === 'sent' && ['sent_date', 'initial_physical_condition', 'initial_functional_condition', 'issued_by', 'approved_by', 'provider_received_by'].some((field) => !nextField(field))) return send(response, 400, { error: 'Complete dispatch date, initial conditions, and all dispatch sign-offs before sending' });
    if (nextStatus === 'returned' && ['returned_date', 'returned_physical_condition', 'returned_functional_condition', 'returned_by_provider', 'received_by', 'return_approved_by'].some((field) => !nextField(field))) return send(response, 400, { error: 'Complete return date, received conditions, and all return sign-offs before marking returned' });
    const updated = await updateEntity('ExternalCalibration', cycle.id, { ...changes, updated_by_id: actor.id, updated_by_name: actor.full_name || actor.email });
    return send(response, 200, updated);
  }
  const externalReview = pathname.match(/^\/api\/external-calibrations\/([^/]+)\/review$/);
  if (externalReview && request.method === 'POST') {
    if (!['admin', 'qa_manager'].includes(actor.role)) return forbidden(response);
    const cycle = (await listEntity('ExternalCalibration')).find((entry) => entry.id === externalReview[1]);
    if (!cycle || cycle.status !== 'returned') return send(response, 409, { error: 'Only returned equipment can be reviewed' });
    if (!cycle.certificate_file || !cycle.certificate_number || !cycle.calibration_date || !cycle.calibration_result) return send(response, 400, { error: 'Certificate file, number, calibration date, and result are required before review' });
    const item = await body(request);
    if (!['accepted', 'rejected'].includes(item.decision)) return send(response, 400, { error: 'Choose accepted or rejected' });
    const reviewedAt = new Date().toISOString();
    let equipmentUpdate = null;
    if (item.decision === 'accepted') {
      const row = await get('SELECT payload FROM equipment WHERE id = ?', [cycle.equipment_id]);
      if (!row) return send(response, 404, { error: 'Equipment not found; external cycle was not completed' });
      const equipment = JSON.parse(row.payload);
      const calibrationDate = String(cycle.calibration_date || '').trim();
      const verifiedDate = parseISO(calibrationDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(calibrationDate) || !isValid(verifiedDate) || format(verifiedDate, 'yyyy-MM-dd') !== calibrationDate) {
        return send(response, 400, { error: 'Calibration date must be a valid calendar date' });
      }
      if (calibrationDate > format(new Date(), 'yyyy-MM-dd')) return send(response, 400, { error: 'Calibration date cannot be in the future' });
      const nextDue = format(subDays(addMonths(verifiedDate, Number(equipment.frequency_months) || 12), 1), 'yyyy-MM-dd');
      equipmentUpdate = { equipment, nextDue };
    }
    if (equipmentUpdate) {
      const { equipment, nextDue } = equipmentUpdate;
      const updatedEquipment = { ...equipment, last_verification_date: cycle.calibration_date, next_due_date: nextDue, last_result: cycle.calibration_result, certificate_number: cycle.certificate_number, updated_by_name: actor.full_name || actor.email, updated_date: reviewedAt };
      await run('UPDATE equipment SET next_due_date=?,payload=?,imported_at=? WHERE id=?', [nextDue, JSON.stringify(updatedEquipment), reviewedAt, cycle.equipment_id]);
    }
    const updated = await updateEntity('ExternalCalibration', cycle.id, {
      certificate_review_status: item.decision, review_remarks: clean(item.remarks), reviewed_by_id: actor.id,
      reviewed_by_name: actor.full_name || actor.email, reviewed_at: reviewedAt,
      ...(item.decision === 'accepted' ? { status: 'completed', next_due_date: equipmentUpdate.nextDue } : {}),
    });
    return send(response, 200, updated);
  }
  if (pathname === '/api/equipment' && request.method === 'GET') { const rows = await all('SELECT payload FROM equipment ORDER BY equipment_code'); return send(response, 200, rows.map((row) => JSON.parse(row.payload))); }
  if (pathname === '/api/standard-equipment' && request.method === 'GET') return send(response, 200, await standardRows());
  if (pathname === '/api/standard-equipment' && request.method === 'POST') {
    if (!isAdmin(actor)) return forbidden(response);
    const item = await body(request);
    const fields = ['control_number', 'equipment_type', 'maker_model', 'serial_number', 'accuracy', 'calibrated_by', 'traceability', 'certificate_number', 'range', 'location'];
    const record = Object.fromEntries(fields.map((field) => [field, String(item[field] || '').trim()]));
    if (!record.control_number || !record.equipment_type) return send(response, 400, { error: 'Control number and equipment type are required' });
    const existing = await standardRows();
    if (existing.some((row) => String(row.control_number || '').trim().toLowerCase() === record.control_number.toLowerCase())) {
      return send(response, 409, { error: 'A standard with that control number already exists' });
    }
    const created = await createEntity('StandardEquipment', { ...record, source: 'manual' });
    return send(response, 201, created);
  }
  if (pathname === '/api/equipment' && request.method === 'POST') { if (!isAdmin(actor)) return forbidden(response); const item = await body(request); const record = { ...item, id: item.id || `local-${Date.now()}`, excel_data: item.excel_data || {}, source_sheet: item.source_sheet || 'Application' }; await run('INSERT INTO equipment (id,equipment_code,equipment_name,department,location,next_due_date,source_sheet,source_row,payload,imported_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [record.id, record.equipment_code || '', record.equipment_name || '', record.department || '', record.location || '', record.next_due_date || '', record.source_sheet, record.source_row || 0, JSON.stringify(record), new Date().toISOString()]); return send(response, 201, record); }
  const match = pathname.match(/^\/api\/equipment\/([^/]+)$/);
  if (match && request.method === 'PUT') { let item = await body(request); if (!isAdmin(actor) && (actor.role !== 'user' || Object.keys(item).length !== 1 || !Object.hasOwn(item, 'equipment_name') || !String(item.equipment_name || '').trim())) return forbidden(response); if (!isAdmin(actor)) item = { equipment_name: String(item.equipment_name).trim() }; const existing = await get('SELECT payload FROM equipment WHERE id = ?', [match[1]]); if (!existing) return send(response, 404, { error: 'Equipment not found' }); const record = { ...JSON.parse(existing.payload), ...item, id: match[1] }; await run('UPDATE equipment SET equipment_code=?,equipment_name=?,department=?,location=?,next_due_date=?,payload=?,imported_at=? WHERE id=?', [record.equipment_code || '', record.equipment_name || '', record.department || '', record.location || '', record.next_due_date || '', JSON.stringify(record), new Date().toISOString(), match[1]]); return send(response, 200, record); }
  if (match && request.method === 'DELETE') { if (!isAdmin(actor)) return forbidden(response); await run('DELETE FROM equipment WHERE id = ?', [match[1]]); return send(response, 200, { id: match[1] }); }
  if (pathname === '/api/equipment/import' && request.method === 'POST') { if (!isAdmin(actor)) return forbidden(response); await importWorkbook(); return send(response, 200, { imported: (await get('SELECT COUNT(*) AS count FROM equipment')).count }); }

  const entityMatch = pathname.match(/^\/api\/entities\/([^/]+)$/);
  if (entityMatch && request.method === 'GET') {
    const name = entityMatch[1];
    if (!['AppSettings', 'VerificationRecord', 'Report', 'AuditLog', 'User'].includes(name)) return send(response, 404, { error: 'Not found' });
    if (['User', 'AuditLog'].includes(name) && !isAdmin(actor)) return forbidden(response);
    const rows = await listEntity(name);
    if (name === 'User') return send(response, 200, rows.map(publicUser));
    return send(response, 200, name === 'Report' && actor.role === 'user'
      ? rows.filter((report) => report.created_by_id === actor.id || report.status === 'approved')
      : rows);
  }
  if (entityMatch && request.method === 'POST') {
    const name = entityMatch[1];
    if (!['AppSettings', 'VerificationRecord', 'Report', 'AuditLog', 'User'].includes(name)) return send(response, 404, { error: 'Not found' });
    let item = await body(request);
    if (name === 'User') {
      if (!isAdmin(actor)) return forbidden(response);
      const idNumber = String(item.id_number || '').trim();
      if (!idNumber || !validPassword(item.password)) return send(response, 400, { error: 'ID number and password are required' });
      if (!['user', 'sr_staff', 'qa_manager', 'admin'].includes(item.role)) return send(response, 400, { error: 'Invalid user role' });
      const users = await listEntity('User');
      if (users.some((user) => String(user.id_number || '').toLowerCase() === idNumber.toLowerCase())) return send(response, 409, { error: 'That ID number already exists' });
      const { password, ...profile } = item;
      item = { ...profile, id_number: idNumber, username: idNumber, password_hash: await hashPassword(password), disabled: false };
    }
    if (name === 'AppSettings' && !isAdmin(actor)) return forbidden(response);
    if (name === 'VerificationRecord') {
      if (!isAdmin(actor) && actor.role !== 'user') return forbidden(response);
      const equipmentRow = await get('SELECT payload FROM equipment WHERE id = ?', [String(item.equipment_id || '')]);
      if (equipmentRow && String(JSON.parse(equipmentRow.payload).calibration_type || '').trim().toLowerCase() === 'external provider calibration') {
        return send(response, 400, { error: 'This equipment uses external provider calibration. Use the External Calibration workflow instead.' });
      }
      item = { ...item, verified_by_id: actor.id, verified_by_name: actor.full_name || actor.email, verified_by_email: actor.email };
    }
    if (name === 'AuditLog') item = { ...item, user_id: actor.id, user_email: actor.email, user_name: actor.full_name || actor.email };
    if (name === 'Report') {
      if (!isAdmin(actor) && actor.role !== 'user') return forbidden(response);
      if (!['draft', 'submitted'].includes(item.status)) return send(response, 400, { error: 'New reports must be draft or submitted' });
      if (item.verification_id) {
        const verification = (await listEntity('VerificationRecord')).find((entry) => entry.id === item.verification_id);
        const equipmentRow = verification && await get('SELECT payload FROM equipment WHERE id = ?', [verification.equipment_id]);
        if (equipmentRow && String(JSON.parse(equipmentRow.payload).calibration_type || '').trim().toLowerCase() === 'external provider calibration') {
          return send(response, 400, { error: 'External provider calibration uses certificate review, not an internal verification report' });
        }
      }
      item = { ...item, created_by_id: actor.id, created_by_name: actor.full_name || actor.email };
      for (const key of SERVER_OWNED_REPORT_FIELDS) delete item[key]; // [report-engine]
      if (!isAdmin(actor)) {
        delete item.reviewed_by;
        delete item.reviewed_by_id;
        delete item.reviewed_at;
        delete item.approved_by;
        delete item.approved_by_id;
        delete item.approved_at;
      }
      // [report-engine] one report per verification, unique report number - checked against ALL reports, in one lane
      const result = await serialized(async () => {
        const every = await listEntity('Report');
        if (item.verification_id && every.some((report) => report.verification_id === item.verification_id)) return { conflict: 'A report already exists for this verification' };
        return { created: await createEntity('Report', { ...item, report_number: uniqueReportNumber(every, item.report_number) }) };
      });
      if (result.conflict) return send(response, 409, { error: result.conflict });
      return send(response, 201, result.created);
    }
    const created = await createEntity(name, item);
    return send(response, 201, name === 'User' ? publicUser(created) : created);
  }

  const entityItemMatch = pathname.match(/^\/api\/entities\/([^/]+)\/([^/]+)$/);
  if (entityItemMatch && request.method === 'PUT') {
    const [, name, rowId] = entityItemMatch;
    let item = await body(request);
    if (!['AppSettings', 'VerificationRecord', 'Report', 'AuditLog', 'User'].includes(name)) return send(response, 404, { error: 'Not found' });
    if (name === 'User' && !isAdmin(actor)) return forbidden(response);
    if (name === 'AppSettings' && !isAdmin(actor)) return forbidden(response);
    if (name === 'AuditLog') return forbidden(response);
    if (name === 'VerificationRecord') {
      const record = (await listEntity('VerificationRecord')).find((entry) => entry.id === rowId);
      if (!record || (!isAdmin(actor) && record.verified_by_id !== actor.id)) return forbidden(response);
      item = Object.fromEntries(Object.entries(item).filter(([key]) => ['attachment_uri', 'attachment_name'].includes(key)));
    }
    if (name === 'User') {
      item = Object.fromEntries(Object.entries(item).filter(([key]) => ['role', 'disabled', 'full_name', 'email', 'position', 'signature_data'].includes(key)));
      if (actor.id === rowId) { delete item.role; delete item.disabled; }
      if (Object.hasOwn(item, 'full_name')) {
        item.full_name = String(item.full_name || '').trim();
        if (!item.full_name || item.full_name.length > 120) return send(response, 400, { error: 'Enter a name up to 120 characters' });
      }
      if (Object.hasOwn(item, 'signature_data') && item.signature_data !== '' &&
        (typeof item.signature_data !== 'string' || item.signature_data.length > 350000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(item.signature_data))) {
        return send(response, 400, { error: 'Signature must be a PNG image smaller than 256 KB' });
      }
    }
    if (name === 'Report') {
      const current = (await listEntity('Report')).find((report) => report.id === rowId);
      if (!current) return send(response, 404, { error: 'Record not found' });
      // [report-engine] approved = frozen for everyone, admin included
      if (current.status === 'approved') return send(response, 409, { error: 'Approved reports are locked. Create a revision instead.' });
      for (const key of SERVER_OWNED_REPORT_FIELDS) delete item[key];
      const allowedStatuses = ['draft', 'submitted', 'reviewed', 'approved', 'rejected'];
      if (item.status && !allowedStatuses.includes(item.status)) return send(response, 400, { error: 'Invalid report status' });
      const isAuthor = current.created_by_id === actor.id;
      const editable = ['draft', 'rejected'].includes(current.status) && isAuthor && actor.role === 'user' && ['draft', 'submitted'].includes(item.status);
      const reviewing = current.status === 'submitted' && current.created_by_id !== actor.id && actor.role === 'sr_staff' && ['reviewed', 'rejected'].includes(item.status);
      const approving = current.status === 'reviewed' && current.created_by_id !== actor.id && current.reviewed_by_id !== actor.id && actor.role === 'qa_manager' && ['approved', 'rejected'].includes(item.status);
      if (!(editable || reviewing || approving) && !isAdmin(actor)) return forbidden(response);
      if (reviewing) item = { status: item.status, reviewed_by: actor.full_name || actor.email, reviewed_by_id: actor.id, reviewed_at: new Date().toISOString(), rejection_reason: item.rejection_reason || '' };
      if (approving) item = { status: item.status, ...(item.status === 'approved' ? { approved_by: actor.full_name || actor.email, approved_by_id: actor.id, approved_at: new Date().toISOString() } : { rejected_by: actor.full_name || actor.email, rejected_by_id: actor.id }), rejection_reason: item.rejection_reason || '' };
      if (editable) {
        delete item.created_by_name;
        delete item.reviewed_by;
        delete item.reviewed_by_id;
        delete item.reviewed_at;
        delete item.approved_by;
        delete item.approved_by_id;
        delete item.approved_at;
        delete item.rejected_by;
        delete item.rejected_by_id;
        if (item.status === 'submitted') item = { ...item, reviewed_by: '', reviewed_by_id: '', reviewed_at: '', approved_by: '', approved_by_id: '', approved_at: '' };
      }
      if (isAdmin(actor)) {
        if (item.status === 'reviewed') item = { ...item, reviewed_by: actor.full_name || actor.email, reviewed_by_id: actor.id, reviewed_at: new Date().toISOString() };
        if (item.status === 'approved') item = { ...item, approved_by: actor.full_name || actor.email, approved_by_id: actor.id, approved_at: new Date().toISOString() };
        if (item.status === 'rejected') {
          item = { ...item, rejected_by: actor.full_name || actor.email, rejected_by_id: actor.id, rejection_reason: item.rejection_reason || '' };
          if (current.status === 'reviewed') item = { ...item, reviewed_by: current.reviewed_by, reviewed_by_id: current.reviewed_by_id, reviewed_at: current.reviewed_at };
          else {
            delete item.reviewed_by;
            delete item.reviewed_by_id;
            delete item.reviewed_at;
          }
        }
      }
      delete item.created_by_id;
      delete item.password_hash;
    }
    let updated = await updateEntity(name, rowId, item);
    if (!updated) return send(response, 404, { error: 'Record not found' });
    // [report-engine] the moment a report becomes 'approved', freeze its Excel + PDF copy on disk
    if (name === 'Report' && updated.status === 'approved' && !updated.final_pdf_path) {
      try {
        updated = await engine.finalizeApproved(updated);
      } catch (error) {
        // never leave a report "approved" without its saved file: put it back to 'reviewed'
        await updateEntity('Report', rowId, { status: 'reviewed', approved_by: '', approved_by_id: '', approved_at: '' });
        return send(response, 500, { error: `Approval was not saved - could not create the final file: ${error.message}` });
      }
    }
    return send(response, 200, name === 'User' ? publicUser(updated) : updated);
  }
  if (entityItemMatch && request.method === 'DELETE') {
    const [, name, rowId] = entityItemMatch;
    if (!['AppSettings', 'VerificationRecord', 'Report', 'AuditLog', 'User'].includes(name)) return send(response, 404, { error: 'Not found' });
    if (['AppSettings', 'AuditLog', 'User'].includes(name) && !isAdmin(actor)) return forbidden(response);
    if (name === 'VerificationRecord') {
      const record = (await listEntity('VerificationRecord')).find((entry) => entry.id === rowId);
      if (!record || (!isAdmin(actor) && record.verified_by_id !== actor.id)) return forbidden(response);
    }
    if (name === 'Report') {
      const report = (await listEntity('Report')).find((entry) => entry.id === rowId);
      if (!report || (!isAdmin(actor) && (!['draft', 'rejected'].includes(report.status) || report.created_by_id !== actor.id))) return forbidden(response);
      if (report.status === 'approved') return send(response, 409, { error: 'Approved reports cannot be deleted' }); // [report-engine]
    }
    return send(response, 200, await deleteEntity(name, rowId));
  }

  return send(response, 404, { error: 'Not found' });
}
await ensureSharedEntityStore();
await importWorkbook();
const port = Number(process.env.API_PORT || process.env.PORT) || 3001;
http.createServer((request, response) => handler(request, response).catch((error) => send(response, 500, { error: error.message }))).listen(port, '0.0.0.0', () => console.log(`SQLite API listening on http://0.0.0.0:${port}`));