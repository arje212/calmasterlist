#!/usr/bin/env node
// server/reset-admin.mjs
// Secure offline administrative password recovery and bootstrapping utility.
// Usage: node server/reset-admin.mjs <id_number> [full_name]

import sqlite3 from 'sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');
const dbPath = process.env.CALIBRATRACK_DB || path.join(projectRoot, 'calibratrack.sqlite');

const [, , idNumber, fullName] = process.argv;

if (!idNumber) {
  console.log(`
QA/QC Nikkoshi System Administrator Password Recovery Utility
-----------------------------------------------------
Usage:
  node server/reset-admin.mjs <id_number> [full_name]

Examples:
  node server/reset-admin.mjs 1863
  node server/reset-admin.mjs 9999 "Emergency Admin"

The password is entered without echoing so it is not exposed in shell history or process arguments.
`);
  process.exit(1);
}

function promptPassword() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this utility in an interactive terminal to enter the password securely.');
  }
  return new Promise((resolve, reject) => {
    let password = '';
    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Password entry cancelled'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(password);
          return;
        }
        if (char === '\u007f' || char === '\b') password = password.slice(0, -1);
        else if (char >= ' ' && char !== '\u007f') password += char;
      }
    };
    process.stdout.write('New password (input hidden): ');
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

const scrypt = (password, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key)))
  );

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt);
  return `${salt}:${key.toString('hex')}`;
}

const db = new sqlite3.Database(dbPath);
const run = (sql, params = []) =>
  new Promise((resolve, reject) => db.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));
const all = (sql, params = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

async function main() {
  const cleanId = String(idNumber).trim();
  if (!cleanId || cleanId.length > 120) throw new Error('ID number must contain 1–120 characters.');
  const newPassword = await promptPassword();
  if (newPassword.length < 8 || newPassword.length > 256) throw new Error('Password must be between 8 and 256 characters.');
  await run('CREATE TABLE IF NOT EXISTS entity_store (entity_name TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, created_date TEXT, updated_date TEXT, PRIMARY KEY(entity_name, id))');
  await run('CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)');
  const passwordHash = await hashPassword(newPassword);
  const now = new Date().toISOString();

  const rows = await all('SELECT id, payload FROM entity_store WHERE entity_name = "User"');
  const existingRow = rows.find((r) => {
    try {
      const p = JSON.parse(r.payload);
      return String(p.id_number || '').trim().toLowerCase() === cleanId.toLowerCase() ||
             String(p.username || '').trim().toLowerCase() === cleanId.toLowerCase();
    } catch {
      return false;
    }
  });

  if (existingRow) {
    const user = JSON.parse(existingRow.payload);
    user.password_hash = passwordHash;
    user.role = 'admin'; // ensure admin role
    user.disabled = false;
    if (fullName) user.full_name = fullName;
    user.updated_date = now;

    await run('UPDATE entity_store SET payload = ?, updated_date = ? WHERE entity_name = "User" AND id = ?', [
      JSON.stringify(user),
      now,
      existingRow.id,
    ]);
    await run('DELETE FROM auth_sessions WHERE user_id = ?', [existingRow.id]);
    console.log(`[OK] Successfully reset password and confirmed admin role for user "${cleanId}".`);
  } else {
    const userId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = {
      id: userId,
      id_number: cleanId,
      username: cleanId,
      email: `${cleanId}@local.test`,
      full_name: fullName || cleanId,
      role: 'admin',
      disabled: false,
      password_hash: passwordHash,
      created_date: now,
      updated_date: now,
    };
    await run(
      'INSERT INTO entity_store (entity_name, id, payload, created_date, updated_date) VALUES (?, ?, ?, ?, ?)',
      ['User', userId, JSON.stringify(user), now, now]
    );
    console.log(`[OK] Successfully created new administrator account for user "${cleanId}".`);
  }

  // Record audit log
  const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const auditItem = {
    id: auditId,
    user_id: 'CLI',
    user_name: 'CLI Recovery Utility',
    user_email: 'console@localhost',
    user_role: 'ADMIN',
    action: 'reset_admin_cli',
    entity_type: 'User',
    entity_id: cleanId,
    entity_label: cleanId,
    details: 'Administrator password reset or created via CLI recovery utility',
    created_date: now,
    updated_date: now,
  };
  await run(
    'INSERT INTO entity_store (entity_name, id, payload, created_date, updated_date) VALUES (?, ?, ?, ?, ?)',
    ['AuditLog', auditId, JSON.stringify(auditItem), now, now]
  );

  db.close();
}

main().catch((err) => {
  console.error('[FAILED]', err.message);
  process.exit(1);
});
