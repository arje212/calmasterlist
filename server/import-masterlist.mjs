// import-masterlist.mjs  -- refresh the MME_ALL rows of calibratrack.sqlite from the Sept-28-2026 masterlist
//
//   npm i better-sqlite3
//   node import-masterlist.mjs --db ./calibratrack.sqlite                 DRY RUN (nothing is written)
//   node import-masterlist.mjs --db ./calibratrack.sqlite --apply         backup + one transaction
//
// Optional flags (all OFF by default):
//   --retire-missing      mark MME_ALL rows that are no longer in the file as deleted:true (soft delete, never DELETE)
//   --hide-legacy-dupes   mark legacy-sheet rows (xFPIP-Mavic, PANASONIC...) whose control no. now exists in MME_ALL
//                         as deleted:true. Rows that have Reports/Verifications/External Cal are NEVER touched.
import Database from 'better-sqlite3';
import fs from 'node:fs';

const flag = (k) => process.argv.includes(`--${k}`);
const val = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const dbPath = val('db'); const APPLY = flag('apply');
if (!dbPath) { console.error('Missing --db <path to calibratrack.sqlite>'); process.exit(1); }
const incoming = JSON.parse(fs.readFileSync(val('json', './masterlist-2026-09.json'), 'utf8'));
const SHEET = 'MME_ALL';
const db = new Database(dbPath);

const canonCode = (s) => { const t = String(s || '').replace(/\s+/g, '').toUpperCase(); const m = t.match(/^(.*?)(\d+)([A-Z]{2})$/); return m ? `${m[1]}${parseInt(m[2], 10)}${m[3]}` : t; };
const canonText = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

// ---- what already exists / what is referenced by Reports, Verifications, External Cal ----
const all = db.prepare('SELECT * FROM equipment').all().map((r) => ({ ...r, p: JSON.parse(r.payload) }));
const refs = new Set();
for (const r of db.prepare("SELECT payload FROM entity_store WHERE entity_name IN ('Report','VerificationRecord','ExternalCalibration')").all()) {
  try { const j = JSON.parse(r.payload); if (j.equipment_id) refs.add(j.equipment_id); } catch {}
}
const mine = all.filter((r) => r.source_sheet === SHEET);
const legacy = all.filter((r) => r.source_sheet !== SHEET);
const usedIds = new Set(all.map((r) => r.id));

// ---- match by control no. (+ range when the same control no. appears more than once) ----
const group = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x); (m.get(k) || m.set(k, []).get(k)).push(x); } return m; };
const oldBy = group(mine, (r) => canonCode(r.equipment_code));
const newBy = group(incoming, (n) => canonCode(n.equipment_code));
const plan = { update: [], insert: [], missing: [] };
const taken = new Set();
for (const [code, news] of newBy) {
  const olds = [...(oldBy.get(code) || [])].sort((a, b) => a.source_row - b.source_row);
  const pending = [];
  for (const n of news) {
    const i = news.length > 1 ? olds.findIndex((o) => !taken.has(o) && canonText(o.p.description) === canonText(n.fields.description)) : -1;
    if (i >= 0) { taken.add(olds[i]); plan.update.push({ old: olds[i], n }); } else pending.push(n);
  }
  for (const n of pending) {
    const i = olds.findIndex((o) => !taken.has(o));
    if (i >= 0) { taken.add(olds[i]); plan.update.push({ old: olds[i], n }); } else plan.insert.push(n);
  }
}
for (const o of mine) if (!taken.has(o)) plan.missing.push(o);

// ---- field-level changes + protection of newer in-app verifications ----
const keepNewer = [];
let changedRows = 0;
for (const u of plan.update) {
  const f = { ...u.n.fields };
  const oldLast = u.old.p.last_verification_date || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(oldLast) && oldLast > (f.last_verification_date || '')) {   // app already has a newer verification than the Excel
    keepNewer.push({ id: u.old.id, code: u.old.equipment_code, in_app_last: oldLast, excel_last: f.last_verification_date });
    f.last_verification_date = u.old.p.last_verification_date; f.next_due_date = u.old.p.next_due_date; f.last_result = u.old.p.last_result;
  }
  u.merged = { ...u.old.p, ...f, department: u.old.p.department || SHEET, source_sheet: SHEET, source_row: u.n.source_row, excel_data: u.n.excel_data };
  if (JSON.stringify(u.merged) !== JSON.stringify(u.old.p)) changedRows++;
}

// ---- optional soft-deletes ----
const newCodes = new Set(incoming.map((n) => canonCode(n.equipment_code)));
const retire = flag('retire-missing') ? plan.missing.filter((o) => !refs.has(o.id)) : [];
const dupes = legacy.filter((r) => newCodes.has(canonCode(r.equipment_code)) && !r.p.deleted);
const hide = flag('hide-legacy-dupes') ? dupes.filter((r) => !refs.has(r.id)) : [];

const summary = {
  'DB rows now (all sheets)': all.length, 'MME_ALL rows in DB': mine.length, 'Rows in new file': incoming.length,
  'UPDATE (matched)': plan.update.length, '  of which actually changed': changedRows, '  in-app newer verification kept': keepNewer.length,
  'INSERT (new equipment)': plan.insert.length, 'MME_ALL in DB but not in file': plan.missing.length,
  'Legacy-sheet rows duplicating an MME_ALL code': dupes.length, '  of which referenced by reports (protected)': dupes.filter((r) => refs.has(r.id)).length,
  'Will soft-delete: missing': retire.length, 'Will soft-delete: legacy dupes': hide.length,
};
console.table(summary);
fs.writeFileSync('import-report.json', JSON.stringify({ summary,
  new_equipment: plan.insert.map((n) => `${n.equipment_code} | ${n.fields.equipment_name} | ${n.fields.description}`),
  missing_from_file: plan.missing.map((o) => ({ id: o.id, code: o.equipment_code, name: o.equipment_name, referenced: refs.has(o.id) })),
  kept_newer_in_app: keepNewer,
  legacy_duplicates: dupes.map((r) => ({ id: r.id, sheet: r.source_sheet, code: r.equipment_code, referenced: refs.has(r.id) })),
}, null, 1));
console.log('Report written: import-report.json');
if (!APPLY) { console.log('\nDRY RUN - nothing changed. Re-run with --apply to write.'); process.exit(0); }

// ---- apply ----
const backup = `${dbPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await db.backup(backup); console.log('Backup:', backup);
const now = new Date().toISOString();
const upd = db.prepare('UPDATE equipment SET equipment_code=@c, equipment_name=@n, department=@d, location=@l, next_due_date=@due, source_row=@sr, payload=@p, imported_at=@t WHERE id=@id');
const ins = db.prepare('INSERT INTO equipment (id,equipment_code,equipment_name,department,location,next_due_date,source_sheet,source_row,payload,imported_at) VALUES (@id,@c,@n,@d,@l,@due,@s,@sr,@p,@t)');
const row = (id, p) => ({ id, c: p.equipment_code, n: p.equipment_name, d: p.department, l: p.location, due: p.next_due_date || '', sr: p.source_row, p: JSON.stringify(p), t: now });
db.transaction(() => {
  for (const u of plan.update) upd.run(row(u.old.id, u.merged));
  for (const n of plan.insert) {
    let id = `excel-mme_all-${n.source_row}`; if (usedIds.has(id)) id = `${id}-${now.slice(0, 10)}`; usedIds.add(id);
    const p = { id, ...n.fields, department: SHEET, deleted: false, source_sheet: SHEET, source_row: n.source_row, excel_data: n.excel_data };
    ins.run({ ...row(id, p), s: SHEET });
  }
  for (const o of [...retire, ...hide]) upd.run(row(o.id, { ...o.p, deleted: true }));
})();
console.log(`Done. Updated ${plan.update.length}, inserted ${plan.insert.length}, soft-deleted ${retire.length + hide.length}.`);
