// reset-trial-data.mjs -- remove TRIAL data so only the real Sept-28-2026 MME_ALL masterlist remains.
//
//   node server\reset-trial-data.mjs --db .\calibratrack.sqlite --json .\server\masterlist-2026-09.json            DRY RUN
//   node server\reset-trial-data.mjs --db .\calibratrack.sqlite --json .\server\masterlist-2026-09.json --apply    backup + transaction
//
// DELETES : equipment rows from legacy sheets (everything not MME_ALL)
//           Report, VerificationRecord, ExternalCalibration records (trial)
// RESETS  : last verification date / next due / last result of MME_ALL rows back to the Excel values
// --fresh : ALSO delete every MME_ALL row and re-insert the 764 clean rows from the JSON (full clean slate, same ids)
// KEEPS   : User, AppSettings, AuditLog (add --clear-audit to also delete the audit log)
import Database from 'better-sqlite3';
import fs from 'node:fs';

const flag = (k) => process.argv.includes(`--${k}`);
const val = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const dbPath = val('db'); const APPLY = flag('apply'); const FRESH = flag('fresh');
if (!dbPath) { console.error('Missing --db <path>'); process.exit(1); }
const incoming = JSON.parse(fs.readFileSync(val('json', './masterlist-2026-09.json'), 'utf8'));
const byRow = new Map(incoming.map((n) => [n.source_row, n]));
const db = new Database(dbPath);

const TRIAL = ['Report', 'VerificationRecord', 'ExternalCalibration'];
const q = (n) => db.prepare(`SELECT COUNT(*) c FROM entity_store WHERE entity_name='${n}'`).get().c;
const legacyCount = db.prepare("SELECT COUNT(*) c FROM equipment WHERE source_sheet!='MME_ALL'").get().c;
const mme = db.prepare("SELECT * FROM equipment WHERE source_sheet='MME_ALL'").all().map((r) => ({ ...r, p: JSON.parse(r.payload) }));

const resets = [];
for (const r of mme) {
  const n = byRow.get(r.source_row); if (!n) continue;
  const f = n.fields;
  if (r.p.last_verification_date !== f.last_verification_date || r.p.next_due_date !== f.next_due_date || r.p.last_result !== f.last_result) resets.push({ r, f });
}
const files = db.prepare(`SELECT payload FROM entity_store WHERE entity_name IN (${TRIAL.map((t) => `'${t}'`).join(',')})`).all()
  .map((x) => JSON.parse(x.payload)).flatMap((j) => [j.certificate_file, j.pdf_path, j.file_path].filter(Boolean));

console.table({
  'Legacy equipment rows to delete': legacyCount, 'MME_ALL rows deleted & re-inserted fresh (--fresh)': FRESH ? mme.length : 0, 'Report to delete': q('Report'), 'VerificationRecord to delete': q('VerificationRecord'),
  'ExternalCalibration to delete': q('ExternalCalibration'), 'MME_ALL rows whose dates will be reset to Excel': resets.length,
  'AuditLog (kept unless --clear-audit)': q('AuditLog'), 'User (kept)': q('User'), 'MME_ALL rows (kept)': mme.length,
});
if (resets.length) console.log('Reset rows:', resets.map((x) => `${x.r.equipment_code} (${x.r.p.last_verification_date} -> ${x.f.last_verification_date})`).join(', '));
if (files.length) console.log('Files referenced by deleted records (delete manually if you want):', files);
if (!APPLY) { console.log('\nDRY RUN - nothing changed. Re-run with --apply.'); process.exit(0); }

const backup = `${dbPath}.backup-reset-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await db.backup(backup); console.log('Backup:', backup);
const upd = db.prepare('UPDATE equipment SET next_due_date=@due, payload=@p, imported_at=@t WHERE id=@id');
db.transaction(() => {
  db.prepare("DELETE FROM equipment WHERE source_sheet!='MME_ALL'").run();
  db.prepare(`DELETE FROM entity_store WHERE entity_name IN (${TRIAL.map((t) => `'${t}'`).join(',')})`).run();
  if (flag('clear-audit')) db.prepare("DELETE FROM entity_store WHERE entity_name='AuditLog'").run();
  if (FRESH) {
    db.prepare('DELETE FROM equipment').run();
    const ins = db.prepare('INSERT INTO equipment (id,equipment_code,equipment_name,department,location,next_due_date,source_sheet,source_row,payload,imported_at) VALUES (@id,@c,@n,@d,@l,@due,@s,@sr,@p,@t)');
    const now = new Date().toISOString();
    for (const n of incoming) {
      const id = `excel-mme_all-${n.source_row}`;
      const p = { id, ...n.fields, department: 'MME_ALL', deleted: false, source_sheet: 'MME_ALL', source_row: n.source_row, excel_data: n.excel_data };
      ins.run({ id, c: p.equipment_code, n: p.equipment_name, d: 'MME_ALL', l: p.location, due: p.next_due_date || '', s: 'MME_ALL', sr: n.source_row, p: JSON.stringify(p), t: now });
    }
  }
  for (const { r, f } of (FRESH ? [] : resets)) {
    const p = { ...r.p, last_verification_date: f.last_verification_date, next_due_date: f.next_due_date, last_result: f.last_result };
    upd.run({ id: r.id, due: p.next_due_date || '', p: JSON.stringify(p), t: new Date().toISOString() });
  }
})();
console.log('Done.', db.prepare('SELECT COUNT(*) c FROM equipment').get().c, 'equipment rows remain.');
