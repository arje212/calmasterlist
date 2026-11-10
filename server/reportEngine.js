// reportEngine.js  --  drop next to server.js.  Node built-ins only (no new npm packages).
//
//   import { createReportEngine } from './reportEngine.js';
//   const engine = createReportEngine({ listEntity, updateEntity, send, isAdmin, getEquipment });
//   ... inside handler(), after `actor` is resolved and before the /api/entities routes:
//   if (await engine.handle(request, response, pathname, actor)) return;
//   ... and after a Report PUT succeeds with status === 'approved':
//   await engine.finalizeApproved(updated);
//
// Requires on the server PC:  Python 3 + `pip install openpyxl pillow`,  LibreOffice.
//
// What changed vs. the previous version (all backwards compatible):
//   [1] Template files are matched to mappings by their NORMALISED FILE NAME ("00. Dial Indicator_Blank Form.xlsx" ->
//       "dial_indicator"), not by mapping.key.  Before, "..._Blank_Form" files never matched their mapping, and a template
//       found under ../template/ME made Python fail because it only looked in templateDir.  The real path is now passed
//       to fill_report.py as ctx.template_path.
//   [2] Equipment -> template: the LONGEST matching keyword wins ("pocket weighing scale" beats "weighing scale",
//       "laser micrometer" beats "micrometer"); mapping.priority breaks ties.  A template without a mapping can no longer
//       be selected (it used to crash Python with "mapping not found"), and a random template is never used as a fallback.
//   [3] /api/report-templates now also returns match, required_accuracy_cells and header.application_limit_is_formula
//       (the report form needs them) and ALWAYS reports template_exists correctly.
//   [4] Mappings are cached by file modification time (they were re-read from disk many times per request);
//       the template folder scan is cached for 5 s; a broken mapping file is skipped instead of breaking every request.
//   [5] Excel lock files (~$...xlsx) are ignored.
//   [6] Python: UTF-8 environment, a result can no longer be settled twice (timeout + close), temp files are removed when a
//       render fails.
//   [7] Every route is wrapped: errors become JSON { error } with the right status (413 too-large, 400 bad body, 500).
//   [8] finalizeApproved: renders once (it used to build the context twice), and if the frozen files already exist but the
//       database row lost its paths it ADOPTS them instead of throwing forever.  Frozen files are still never overwritten.
//   [9] An approved report whose frozen files are missing is frozen on first download instead of silently re-rendering.
//   [11] Template upload for administrators (/api/report-templates/upload, /drafts/...): analyse -> test PDF -> review -> publish (old files archived)
//   [10] Per-equipment templates: a unit whose control number equals a template name (HP0001RE_Blank_Form.xlsm) uses THAT template;
//        other units of the same type fall back to the type template ("00. Hot Plate_Blank Form").  .xlsm works too.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCAN_TTL_MS = 5000;

const normWords = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function createReportEngine({ listEntity, updateEntity, send, isAdmin, getEquipment, options = {} }) {
  const projectRoot = path.resolve(here, '..');
  const cfg = {
    templateDir: process.env.REPORT_TEMPLATE_DIR || options.templateDir || path.join(here, 'report-engine', 'templates'),
    mappingDir: process.env.REPORT_MAPPING_DIR || options.mappingDir || path.join(here, 'report-engine', 'mappings'),
    script: options.script || path.join(here, 'report-engine', 'fill_report.py'),
    // app-owned storage. Keep this OUTSIDE the folders people use (e.g. D:\nikkoshi-system-data), writable only by the service account.
    dataDir: process.env.REPORT_DATA_DIR || options.dataDir || path.join(projectRoot, 'report-data'),
    python: process.env.PYTHON_PATH || options.python || (process.platform === 'win32' ? 'python' : 'python3'),
    soffice: process.env.SOFFICE_PATH || options.soffice || '',   // e.g. C:\Program Files\LibreOffice\program\soffice.exe
    maxUpload: 12 * 1024 * 1024,
    maxTemplate: 25 * 1024 * 1024,
    analyzer: options.analyzer || path.join(here, 'report-engine', 'tools', 'analyze_template.py'),
    previewer: options.previewer || path.join(here, 'report-engine', 'tools', 'preview_template.py'),
  };
  const templateRoots = [...new Set([
    cfg.templateDir,
    path.join(projectRoot, 'template', 'ME'),
    path.join(projectRoot, 'template'),
  ].filter(Boolean))];
  const dirs = { att: path.join(cfg.dataDir, 'attachments'), approved: path.join(cfg.dataDir, 'approved'), tmp: path.join(cfg.dataDir, 'tmp'),
    drafts: path.join(cfg.dataDir, 'template-drafts'), archive: path.join(cfg.dataDir, 'template-archive') };
  for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });

  // ------------------------------------------------------------------ template files on disk
  /** "00. Temp.Probe Deep Sensing _Blank Form.xlsx" -> "temp_probe_deep_sensing"   ("00__TMR_Blank_Form.xlsx" -> "tmr") */
  const normalizeTemplateKey = (name) => String(name || '')
    .replace(/\.(xlsx|xlsm)$/i, '')
    .replace(/^\d+[\s._-]+/, '')                                  // "00. " / "00__"  (but not "3D Scanner")
    .replace(/[\s_-]*blank?[\s_-]*(form|report)?[\s_-]*$/i, '')   // "_Blank Form" / "_Blank Report" / the typo "_Blan Form"
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

  let filesCache = { at: 0, list: [] };
  const candidateTemplateFiles = () => {
    if (filesCache.list.length && Date.now() - filesCache.at < SCAN_TTL_MS) return filesCache.list;
    const seen = new Map();
    for (const root of templateRoots) {
      if (!fs.existsSync(root)) continue;
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(xlsx|xlsm)$/i.test(entry.name) && !entry.name.startsWith('~$')) {      // ~$ = Excel lock file
            const normalized = normalizeTemplateKey(entry.name);
            if (!normalized || seen.has(normalized)) continue;                                  // first folder wins
            seen.set(normalized, { key: normalized, fileName: entry.name, path: full, source: root });
          }
        }
      };
      walk(root);
    }
    filesCache = { at: Date.now(), list: [...seen.values()] };
    return filesCache.list;
  };

  // ------------------------------------------------------------------ mappings (mappings/*.json), cached by mtime
  const mappingCache = new Map();
  const loadMappings = () => {
    if (!fs.existsSync(cfg.mappingDir)) return [];
    const out = [];
    for (const f of fs.readdirSync(cfg.mappingDir)) {
      if (!f.endsWith('.json')) continue;
      const full = path.join(cfg.mappingDir, f);
      try {
        const mtime = fs.statSync(full).mtimeMs;
        let hit = mappingCache.get(full);
        if (!hit || hit.mtime !== mtime) {
          hit = { mtime, data: JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '')) };
          mappingCache.set(full, hit);
        }
        out.push(hit.data);
      } catch (e) { console.warn(`[reportEngine] mapping "${f}" skipped: ${e.message}`); }
    }
    return out;
  };
  const mappingByKey = (key) => (key ? loadMappings().find((m) => m.key === key) || null : null);

  /** every mapping joined with its Excel file, plus Excel files that have no mapping yet (mapping_configured = false) */
  const discoveredTemplates = () => {
    const files = new Map(candidateTemplateFiles().map((t) => [t.key, t]));
    const byKey = new Map();
    const used = new Set();
    for (const mapping of loadMappings()) {
      const key = mapping.key || normalizeTemplateKey(mapping.template || mapping.label);
      if (!key) continue;
      const file = files.get(normalizeTemplateKey(mapping.template)) || files.get(key);
      if (file) used.add(file.key);
      byKey.set(key, {
        ...mapping, key,
        template: mapping.template || file?.fileName || '',
        label: mapping.label || key,
        file_path: file?.path || '',
        template_exists: Boolean(file),
      });
    }
    for (const file of files.values()) {
      if (used.has(file.key) || byKey.has(file.key)) continue;
      byKey.set(file.key, {
        key: file.key, template: file.fileName, file_path: file.path, template_exists: true,
        label: file.fileName.replace(/\.(xlsx|xlsm)$/i, '').replace(/^\d+[\s._-]*/, '').trim() || file.key,
      });
    }
    return [...byKey.values()];
  };

  /** Which template does this report use?  Explicit choice first, then the best keyword match among MAPPED templates. */
  function templateKeyFor(equipment = {}, report = {}) {
    const explicit = [report.report_template, equipment.template_key].find((k) => k && mappingByKey(k));
    if (explicit) return explicit;
    // a unit with its OWN template: the template is named after the control number (HP0001RE_Blank_Form.xlsm -> "hp0001re")
    const control = String(equipment.equipment_code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (control) { const own = loadMappings().find((m) => m.key === control); if (own) return own.key; }
    const text = ` ${normWords([equipment.equipment_name, equipment.category, equipment.model].filter(Boolean).join(' '))} `;
    if (text.trim() === '') return null;
    let best = null;
    let bestScore = [0, 0, 0];
    for (const m of loadMappings()) {
      if (!m.key || m.per_equipment) continue;                       // a per-equipment template is chosen by control number only
      for (const word of [String(m.key).replace(/_/g, ' '), m.label, ...(m.match || [])].map(normWords).filter(Boolean)) {
        const whole = text.includes(` ${word} `) ? 1 : 0;           // whole word beats partial
        if (!whole && !text.includes(word)) continue;
        const score = [whole, word.length, m.priority || 0];         // then longest keyword, then mapping.priority
        const better = score[0] !== bestScore[0] ? score[0] > bestScore[0] : score[1] !== bestScore[1] ? score[1] > bestScore[1] : score[2] > bestScore[2];
        if (better) { best = m.key; bestScore = score; }
      }
    }
    return best;
  }

  const publicTemplate = (m) => ({
    key: m.key,
    label: m.label || m.template || m.key,
    mapping_configured: Boolean(m.match?.length),
    needs_mapping: !m.match?.length,                                                  // an Excel file nobody has analysed yet
    per_equipment: Boolean(m.per_equipment),                                          // one unit's own template (named by its control number)
    match: m.match || [],
    priority: m.priority || 0,
    default_attachment_slot: m.default_attachment_slot || 'sheet',
    input_groups: m.input_groups || [],
    has_tables: Boolean(m.tables?.length),
    required_accuracy_cells: m.required_accuracy_cells || null,                       // the form shows a hint for rulers / percent templates
    header: { application_limit_is_formula: Boolean(m.header?.application_limit_is_formula) },
    template_exists: Boolean(m.template_exists),
    template: m.template || '',
  });

  // ------------------------------------------------------------------ single-lane queue (LibreOffice hangs on concurrent runs)
  let lane = Promise.resolve();
  const enqueue = (job) => { const p = lane.then(job, job); lane = p.catch(() => {}); return p; };

  const runPython = (ctx, out, pdf) => new Promise((resolve, reject) => {
    const ctxFile = path.join(dirs.tmp, `ctx-${crypto.randomUUID()}.json`);
    fs.writeFileSync(ctxFile, JSON.stringify(ctx));
    const args = [cfg.script, '--ctx', ctxFile, '--out', out, ...(pdf ? ['--pdf', pdf] : [])];
    const child = spawn(cfg.python, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    let stdout = '', stderr = '', settled = false;
    const done = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); fs.rmSync(ctxFile, { force: true }); fn(value); };
    const timer = setTimeout(() => { child.kill(); done(reject, new Error('Report generation timed out')); }, 150000);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => done(reject, new Error(`Cannot start Python (${cfg.python}): ${e.message}`)));
    child.on('close', (code) => {
      if (code !== 0) return done(reject, new Error(`Report generation failed: ${stderr.slice(-400) || stdout.slice(-400)}`));
      try { done(resolve, JSON.parse(stdout.trim().split('\n').pop())); } catch { done(resolve, { ok: true }); }
    });
  });

  // ------------------------------------------------------------------ build the context the Python script reads
  async function buildContext(report) {
    const currentEquipment = getEquipment ? await getEquipment(report.equipment_id) : null;
    const equipment = { ...(currentEquipment || {}), ...(report.equipment_snapshot || {}) };
    for (const key of ['range', 'description', 'accuracy', 'required_accuracy']) {
      if (!equipment[key] && currentEquipment?.[key]) equipment[key] = currentEquipment[key];
    }
    const key = templateKeyFor(equipment, report);
    if (!key) throw new Error(`No report template matches "${equipment.equipment_name || 'this equipment'}". Add a mapping in report-engine/mappings.`);
    const tpl = discoveredTemplates().find((t) => t.key === key);
    if (!tpl) throw new Error(`No mapping exists for template "${key}". Add a mapping file in report-engine/mappings/.`);
    if (!tpl.template_exists || !tpl.file_path) throw new Error(`The Excel file for "${tpl.label}" was not found (looked for "${tpl.template}" in ${templateRoots.join(' , ')}).`);

    const users = await listEntity('User');
    const displayName = (value) => {
      const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length < 2) return parts[0] || '';
      const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv']);
      while (parts.length > 2 && suffixes.has(parts.at(-1).toLowerCase())) parts.pop();
      return `${parts[0][0].toUpperCase()}. ${parts.at(-1)}`;
    };
    const person = (name) => {
      const u = users.find((x) => name && [x.full_name, x.id_number, x.username].some((v) => String(v || '').toLowerCase() === String(name).toLowerCase()));
      return { name: u?.full_name ? displayName(u.full_name) : name || '', position: (u && u.position) || '', signature_data: u?.signature_data || '' };
    };
    const slotDefault = tpl.default_attachment_slot || 'sheet';
    const attachments = (report.attachments || []).map((a) => ({
      path: path.join(dirs.att, report.id, a.file), caption: a.caption || '', annotations: a.annotations || [], slot: a.slot || slotDefault,
    })).filter((a) => fs.existsSync(a.path));
    const data = { ...(report.report_data || {}) };
    if (!data.range) data.range = equipment.range || equipment.description || '';
    if (!data.equipment_accuracy) data.equipment_accuracy = equipment.accuracy || '';
    if (!data.required_accuracy) data.required_accuracy = equipment.required_accuracy || '';
    return {
      template_dir: cfg.templateDir, template_path: tpl.file_path,          // [1] the exact file, wherever it lives
      mapping_dir: cfg.mappingDir, template_key: key, soffice: cfg.soffice || undefined,
      report: { report_number: report.report_number, verification_date: report.verification_date, next_due_date: report.next_due_date, result: report.result, remarks: report.remarks },
      snapshot: equipment, data,
      standards: report.report_data?.standard_equipment?.control_number ? [report.report_data.standard_equipment] : [],
      people: { verified: person(report.verified_by), reviewed: person(report.reviewed_by), approved: person(report.approved_by) },
      attachments,
    };
  }

  const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const safeName = (s) => String(s).replace(/[\\/:*?"<>|\s]+/g, '_');

  /** live preview / on-demand render (drafts, submitted, reviewed).  Approved reports are served from the frozen files instead. */
  function render(report, { pdf = true } = {}) {
    return enqueue(async () => {
      const id = crypto.randomUUID();
      const xlsx = path.join(dirs.tmp, `${id}.xlsx`);
      const pdfFile = pdf ? path.join(dirs.tmp, `${id}.pdf`) : null;
      try {
        const ctx = await buildContext(report);
        const info = await runPython(ctx, xlsx, pdfFile);
        return { xlsx, pdf: pdfFile, warnings: info.warnings || [], template_key: ctx.template_key };
      } catch (e) {
        fs.rmSync(xlsx, { force: true }); if (pdfFile) fs.rmSync(pdfFile, { force: true });
        throw e;
      }
    });
  }

  /** call after a Report becomes 'approved': freeze xlsx + pdf into the approved folder and record their hashes. */
  async function finalizeApproved(report) {
    if (report.final_pdf_path && fs.existsSync(report.final_pdf_path)) return report;         // never regenerate
    const stamp = String(report.approved_at || new Date().toISOString());
    const dir = path.join(dirs.approved, stamp.slice(0, 4), stamp.slice(5, 7)); fs.mkdirSync(dir, { recursive: true });
    const base = safeName(report.report_number);
    const finalXlsx = path.join(dir, `${base}.xlsx`), finalPdf = path.join(dir, `${base}.pdf`);
    let templateKey = report.template_key;
    const haveX = fs.existsSync(finalXlsx), haveP = fs.existsSync(finalPdf);
    if (haveX !== haveP) throw new Error(`Only one approved file exists for ${report.report_number}; check ${dir} before retrying`);   // never overwrite
    if (!haveX) {
      const r = await render(report);
      fs.copyFileSync(r.xlsx, finalXlsx + '.part'); fs.renameSync(finalXlsx + '.part', finalXlsx);          // atomic
      fs.copyFileSync(r.pdf, finalPdf + '.part');  fs.renameSync(finalPdf + '.part', finalPdf);
      for (const f of [finalXlsx, finalPdf]) { try { fs.chmodSync(f, 0o444); } catch { /* NTFS ACL is the real control on Windows */ } }
      fs.rmSync(r.xlsx, { force: true }); fs.rmSync(r.pdf, { force: true });
      templateKey = r.template_key;
    }                                                                                      // else: adopt the files that are already frozen
    return updateEntity('Report', report.id, {
      final_xlsx_path: finalXlsx, final_pdf_path: finalPdf, final_xlsx_sha256: sha256(finalXlsx), final_pdf_sha256: sha256(finalPdf),
      finalized_at: new Date().toISOString(), ...(templateKey ? { template_key: templateKey } : {}),
    });
  }

  // ------------------------------------------------------------------ template upload (admin): analyse -> review -> publish
  //   POST   /api/report-templates/upload                 raw .xlsx/.xlsm body, header x-filename   -> draft
  //   POST   /api/report-templates/analyze-existing       { key }  an Excel file already in templates/ that has no mapping yet
  //   GET    /api/report-templates/drafts[/:id[/preview.pdf]]
  //   PUT    /api/report-templates/drafts/:id             { label, match[] }
  //   POST   /api/report-templates/drafts/:id/publish     { replace }   (the old mapping + file are archived first)
  //   DELETE /api/report-templates/drafts/:id
  const httpError = (status, message) => Object.assign(new Error(message), { status });
  const TEMPLATE_EXT = /\.(xlsx|xlsm)$/i;
  const cleanFileName = (name) => path.basename(String(name || '').replace(/\\/g, '/')).replace(/[^\w.\- ()]+/g, '_').slice(0, 120);
  const draftDir = (id) => { if (!/^[a-f0-9]{12}$/.test(String(id))) throw httpError(404, 'Draft not found'); return path.join(dirs.drafts, id); };
  const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const writeJsonAtomic = (file, data) => { fs.writeFileSync(file + '.part', JSON.stringify(data, null, 1)); fs.renameSync(file + '.part', file); };

  const runScript = (args, timeoutMs = 300000) => new Promise((resolve, reject) => {
    const child = spawn(cfg.python, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', ...(cfg.soffice ? { SOFFICE_PATH: cfg.soffice } : {}) } });
    let stdout = '', stderr = '', settled = false;
    const done = (fn, v) => { if (settled) return; settled = true; clearTimeout(timer); fn(v); };
    const timer = setTimeout(() => { child.kill(); done(reject, httpError(504, 'The analysis took too long')); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => done(reject, httpError(500, `Cannot start Python (${cfg.python}): ${e.message}`)));
    child.on('close', (code) => (code === 0 ? done(resolve, stdout) : done(reject, httpError(422, (stdout.trim().split('\n').pop() || stderr).slice(-300)))));
  });

  const warnNote = /^(HEADER|PEOPLE|STABILIZATION|BODY|OTHER|TABLE WITHOUT|ACCURACY|DUPLICATE|PRINT: (no|LibreOffice))/;
  async function equipmentFor(key) {
    try { return (await listEntity('Equipment')).find((e) => String(e.equipment_code || '').toLowerCase().replace(/[^a-z0-9]/g, '') === key) || null; } catch { return null; }
  }
  async function draftView(id) {
    const dir = draftDir(id);
    if (!fs.existsSync(path.join(dir, 'meta.json'))) throw httpError(404, 'Draft not found');
    const meta = readJson(path.join(dir, 'meta.json')), m = readJson(path.join(dir, meta.mapping_file));
    const eq = m.per_equipment ? await equipmentFor(m.key) : null;
    const existing = { mapping: fs.existsSync(path.join(cfg.mappingDir, m.key + '.json')), template: candidateTemplateFiles().some((t) => t.key === normalizeTemplateKey(meta.filename)) };
    const notes = (m._notes || []).filter((n) => !n.startsWith('SAMPLE'));
    return {
      id, key: m.key, filename: meta.filename, label: m.label, match: m.match || [], per_equipment: Boolean(m.per_equipment), uploaded_by: meta.uploaded_by, uploaded_at: meta.uploaded_at,
      preview: meta.preview, existing, equipment: eq ? { id: eq.id, name: eq.equipment_name, code: eq.equipment_code } : null,
      warnings: notes.filter((n) => warnNote.test(n)), info: notes.filter((n) => !warnNote.test(n)),
      photo_report: Boolean(m.photo_boxes?.length), print_scale: m.print_scale || null, needs_review: Boolean(m.needs_review),
      tables: (m.input_groups || []).map((g) => ({ title: g.title, fields: g.fields.length, rows: new Set(g.fields.map((f) => f.row)).size, columns: [...new Set(g.fields.map((f) => f.col))] })),
    };
  }
  async function createDraft({ buffer, sourcePath, filename, actor }) {
    if (!TEMPLATE_EXT.test(filename)) throw httpError(400, 'Only .xlsx or .xlsm templates are accepted');
    if (buffer && !(buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b)) throw httpError(400, 'That file is not an Excel workbook');
    const id = crypto.randomBytes(6).toString('hex'), dir = path.join(dirs.drafts, id), file = path.join(dir, filename);
    fs.mkdirSync(dir, { recursive: true });
    try {
      if (buffer) fs.writeFileSync(file, buffer); else fs.copyFileSync(sourcePath, file);
      await enqueue(() => runScript([cfg.analyzer, file, '--out', dir, '--quiet']));
      const mappingFile = fs.readdirSync(dir).find((f) => f.endsWith('.json') && f !== 'meta.json');
      if (!mappingFile) throw httpError(422, 'The workbook could not be analysed. It must have a "VERIFICATION_REPORT" sheet with the standard header.');
      let preview;
      try { preview = JSON.parse((await enqueue(() => runScript([cfg.previewer, '--mapping', path.join(dir, mappingFile), '--template', file, '--out', path.join(dir, 'preview.pdf')]))).trim().split('\n').pop()); }
      catch (e) { preview = { ok: false, error: e.message }; }
      writeJsonAtomic(path.join(dir, 'meta.json'), { id, filename, mapping_file: mappingFile, uploaded_by: actor.full_name || actor.email || '', uploaded_at: new Date().toISOString(), preview });
      return await draftView(id);
    } catch (e) { fs.rmSync(dir, { recursive: true, force: true }); throw e; }
  }
  async function publishDraft(id, { replace }) {
    const dir = draftDir(id), meta = readJson(path.join(dir, 'meta.json')), m = readJson(path.join(dir, meta.mapping_file));
    const target = path.join(cfg.mappingDir, m.key + '.json'), sameKey = candidateTemplateFiles().filter((t) => t.key === normalizeTemplateKey(meta.filename));
    if ((fs.existsSync(target) || sameKey.length) && !replace) throw httpError(409, `A template for "${m.key}" already exists. Publish again with "replace" to archive it and use this one.`);
    delete m._notes_published; m.published_at = new Date().toISOString();
    fs.mkdirSync(cfg.templateDir, { recursive: true }); fs.mkdirSync(cfg.mappingDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14), keep = path.join(dirs.archive, `${m.key}-${stamp}`);
    if (fs.existsSync(target) || sameKey.length) {                                       // nothing is ever deleted: the old files are archived
      fs.mkdirSync(keep, { recursive: true });
      if (fs.existsSync(target)) fs.copyFileSync(target, path.join(keep, m.key + '.json'));
      for (const t of sameKey) { fs.copyFileSync(t.path, path.join(keep, t.fileName)); if (path.dirname(t.path) === path.resolve(cfg.templateDir) && t.fileName !== meta.filename) fs.rmSync(t.path); }
    }
    fs.copyFileSync(path.join(dir, meta.filename), path.join(cfg.templateDir, meta.filename + '.part')); fs.renameSync(path.join(cfg.templateDir, meta.filename + '.part'), path.join(cfg.templateDir, meta.filename));
    writeJsonAtomic(target, m);
    filesCache = { at: 0, list: [] };
    fs.rmSync(dir, { recursive: true, force: true });
    const t = discoveredTemplates().find((x) => x.key === m.key);
    return { template: t ? publicTemplate(t) : null, archived: fs.existsSync(keep) ? path.basename(keep) : null };
  }
  async function handleTemplateAdmin(request, response, pathname, actor) {
    const isDraftsRoute = /^\/api\/report-templates\/(upload|analyze-existing|drafts)(\/|$)/.test(pathname);
    if (!isDraftsRoute) return false;
    if (!isAdmin(actor)) { send(response, 403, { error: 'Only an administrator can manage report templates' }); return true; }
    fs.mkdirSync(dirs.drafts, { recursive: true });
    if (pathname === '/api/report-templates/upload' && request.method === 'POST') {
      const filename = cleanFileName(safeDecode(request.headers['x-filename']));
      if (!filename) throw httpError(400, 'x-filename header is required');
      send(response, 201, await createDraft({ buffer: await readBinary(request, cfg.maxTemplate), filename, actor })); return true;
    }
    if (pathname === '/api/report-templates/analyze-existing' && request.method === 'POST') {
      let body; try { body = JSON.parse((await readBinary(request, 20000)).toString() || '{}'); } catch { throw httpError(400, 'Invalid JSON body'); }
      const file = candidateTemplateFiles().find((t) => t.key === String(body.key || ''));
      if (!file) throw httpError(404, 'No Excel template with that key in the templates folder');
      send(response, 201, await createDraft({ sourcePath: file.path, filename: file.fileName, actor })); return true;
    }
    if (pathname === '/api/report-templates/drafts' && request.method === 'GET') {
      const ids = fs.existsSync(dirs.drafts) ? fs.readdirSync(dirs.drafts).filter((d) => /^[a-f0-9]{12}$/.test(d) && fs.existsSync(path.join(dirs.drafts, d, 'meta.json'))) : [];
      send(response, 200, await Promise.all(ids.map((id) => draftView(id)))); return true;
    }
    const d = pathname.match(/^\/api\/report-templates\/drafts\/([a-f0-9]{12})(?:\/(preview\.pdf|publish))?$/);
    if (!d) { send(response, 404, { error: 'Not found' }); return true; }
    const [, id, sub] = d;
    if (!sub && request.method === 'GET') { send(response, 200, await draftView(id)); return true; }
    if (sub === 'preview.pdf' && request.method === 'GET') {
      const pdf = path.join(draftDir(id), 'preview.pdf');
      if (!fs.existsSync(pdf)) throw httpError(404, 'There is no preview for this draft'); sendFile(response, pdf, 'application/pdf', 'template-preview.pdf'); return true;
    }
    if (!sub && request.method === 'PUT') {
      let body; try { body = JSON.parse((await readBinary(request, 20000)).toString() || '{}'); } catch { throw httpError(400, 'Invalid JSON body'); }
      const dir = draftDir(id), meta = readJson(path.join(dir, 'meta.json')), file = path.join(dir, meta.mapping_file), m = readJson(file);
      if (typeof body.label === 'string' && body.label.trim()) m.label = body.label.trim().slice(0, 80);
      if (Array.isArray(body.match) && !m.per_equipment) m.match = [...new Set(body.match.map((w) => String(w).trim().toLowerCase().slice(0, 60)).filter(Boolean))].slice(0, 12);
      writeJsonAtomic(file, m); send(response, 200, await draftView(id)); return true;
    }
    if (sub === 'publish' && request.method === 'POST') {
      let body; try { body = JSON.parse((await readBinary(request, 20000)).toString() || '{}'); } catch { throw httpError(400, 'Invalid JSON body'); }
      send(response, 200, await publishDraft(id, { replace: Boolean(body.replace) })); return true;
    }
    if (!sub && request.method === 'DELETE') { fs.rmSync(draftDir(id), { recursive: true, force: true }); send(response, 200, { id }); return true; }
    send(response, 405, { error: 'Method not allowed' }); return true;
  }

  // ------------------------------------------------------------------ http helpers
  const canSee = (actor, report) => isAdmin(actor) || actor.role !== 'user' || report.created_by_id === actor.id || report.status === 'approved';
  const canEditFiles = (actor, report) => !['approved', 'reviewed', 'submitted'].includes(report.status) &&
    (isAdmin(actor) || (actor.role === 'user' && report.created_by_id === actor.id));
  const findReport = async (id) => (await listEntity('Report')).find((r) => r.id === id);
  function sendFile(response, file, type, filename) {
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': fs.statSync(file).size, 'Content-Disposition': `inline; filename="${filename}"`, 'Cache-Control': 'private, no-store' });
    const stream = fs.createReadStream(file);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  }
  const readBinary = (request, limit) => new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let failed = false;
    request.on('data', (c) => {
      if (failed) return;                                              // keep draining so the client gets our 413 instead of a reset
      size += c.length;
      if (size > limit) { failed = true; reject(Object.assign(new Error(`File too large (max ${Math.round(limit / 1048576)} MB)`), { status: 413 })); } else chunks.push(c);
    });
    request.on('end', () => { if (!failed) resolve(Buffer.concat(chunks)); });
    request.on('error', (e) => { if (!failed) reject(e); });
  });
  const imageType = (b) => (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 ? 'jpg' : b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'png' : null);   // trust content, not filename
  const safeDecode = (v) => { try { return decodeURIComponent(String(v || '')); } catch { return String(v || ''); } };

  /** returns true when the request was handled */
  async function route(request, response, pathname, actor) {
    if (await handleTemplateAdmin(request, response, pathname, actor)) return true;
    if (pathname === '/api/report-templates' && request.method === 'GET') { send(response, 200, discoveredTemplates().map(publicTemplate)); return true; }
    const tpl = pathname.match(/^\/api\/report-templates\/([a-z0-9_]+)$/);
    if (tpl && request.method === 'GET') {
      const m = discoveredTemplates().find((entry) => entry.key === tpl[1]);
      send(response, m ? 200 : 404, m ? publicTemplate(m) : { error: 'Template not found' });
      return true;
    }

    const file = pathname.match(/^\/api\/reports\/([^/]+)\/(pdf|xlsx)$/);
    if (file && request.method === 'GET') {
      let report = await findReport(file[1]);
      if (!report || !canSee(actor, report)) { send(response, 404, { error: 'Report not found' }); return true; }
      const kind = file[2], type = kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const frozenOf = (r) => (kind === 'pdf' ? r.final_pdf_path : r.final_xlsx_path);
      if (report.status === 'approved' && !(frozenOf(report) && fs.existsSync(frozenOf(report)))) {
        try { await finalizeApproved(report); report = (await findReport(file[1])) || report; }          // [9] freeze it now
        catch (e) { console.warn(`[reportEngine] could not freeze ${report.report_number}: ${e.message}`); }
      }
      if (report.status === 'approved' && frozenOf(report) && fs.existsSync(frozenOf(report))) {
        sendFile(response, frozenOf(report), type, `${safeName(report.report_number)}.${kind}`); return true;
      }
      const r = await render(report, { pdf: kind === 'pdf' });
      const out = kind === 'pdf' ? r.pdf : r.xlsx;
      response.on('close', () => { fs.rmSync(r.xlsx, { force: true }); if (r.pdf) fs.rmSync(r.pdf, { force: true }); });
      sendFile(response, out, type, `${safeName(report.report_number)}${report.status === 'approved' ? '' : '-PREVIEW'}.${kind}`);
      return true;
    }

    const att = pathname.match(/^\/api\/reports\/([^/]+)\/attachments(?:\/([^/]+))?(?:\/(file))?$/);
    if (att) {
      const [, reportId, attId, isFile] = att;
      const report = await findReport(reportId);
      if (!report || !canSee(actor, report)) { send(response, 404, { error: 'Report not found' }); return true; }
      const list = report.attachments || [];
      if (request.method === 'GET' && !attId) { send(response, 200, list); return true; }
      if (request.method === 'GET' && attId && isFile) {
        const a = list.find((x) => x.id === attId), p = a && path.join(dirs.att, reportId, a.file);
        if (!a || !fs.existsSync(p)) { send(response, 404, { error: 'Attachment not found' }); return true; }
        sendFile(response, p, a.file.endsWith('.png') ? 'image/png' : 'image/jpeg', a.file); return true;
      }
      if (!canEditFiles(actor, report)) { send(response, 403, { error: 'Attachments are locked for this report' }); return true; }
      if (request.method === 'POST' && !attId) {
        if (list.length >= 12) { send(response, 400, { error: 'Maximum 12 attachments per report' }); return true; }
        const buf = await readBinary(request, cfg.maxUpload), ext = imageType(buf);
        if (!ext) { send(response, 400, { error: 'Only JPEG or PNG images are allowed' }); return true; }
        const id = crypto.randomUUID(), name = `${id}.${ext}`;
        fs.mkdirSync(path.join(dirs.att, reportId), { recursive: true });
        fs.writeFileSync(path.join(dirs.att, reportId, name), buf);
        const caption = safeDecode(request.headers['x-caption']).slice(0, 300);
        const slot = ['body', 'sheet'].includes(request.headers['x-slot']) ? request.headers['x-slot'] : undefined;
        const item = { id, file: name, caption, annotations: [], ...(slot ? { slot } : {}), uploaded_by: actor.full_name || actor.email, uploaded_at: new Date().toISOString(), size: buf.length };
        await updateEntity('Report', reportId, { attachments: [...list, item] });
        send(response, 201, item); return true;
      }
      if (request.method === 'PUT' && attId) {                                    // caption / annotations
        let body;
        try { body = JSON.parse((await readBinary(request, 200000)).toString() || '{}'); } catch (e) { if (e.status) throw e; send(response, 400, { error: 'Invalid JSON body' }); return true; }
        const next = list.map((a) => a.id !== attId ? a : { ...a,
          caption: String(body.caption ?? a.caption).slice(0, 300),
          annotations: Array.isArray(body.annotations) ? body.annotations.slice(0, 20).filter((n) => ['circle', 'arrow'].includes(n.type)) : a.annotations });
        await updateEntity('Report', reportId, { attachments: next }); send(response, 200, next.find((a) => a.id === attId)); return true;
      }
      if (request.method === 'DELETE' && attId) {
        const a = list.find((x) => x.id === attId);
        if (a) fs.rmSync(path.join(dirs.att, reportId, a.file), { force: true });
        await updateEntity('Report', reportId, { attachments: list.filter((x) => x.id !== attId) }); send(response, 200, { id: attId }); return true;
      }
    }
    return false;
  }

  /** returns true when the request was handled.  Errors never escape: they are sent as JSON { error }. */
  async function handle(request, response, pathname, actor) {
    try {
      return await route(request, response, pathname, actor);
    } catch (e) {
      console.error(`[reportEngine] ${request.method} ${pathname}: ${e.message}`);
      if (!response.headersSent) send(response, e.status || 500, { error: e.message });
      else response.end();
      return true;
    }
  }

  return { handle, finalizeApproved, render, templateKeyFor, mappingByKey, discoveredTemplates, config: cfg };
}
