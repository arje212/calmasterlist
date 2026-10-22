import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/api/apiClient';
import ReportAttachments from '@/components/reports/ReportAttachments';

/* ============================================================================
   Shared helpers (also imported by CaliperReportDocumentStyled.jsx)
   ============================================================================ */
const REPETITIONS = [1, 2, 3, 4, 5];
export const MEASURED = REPETITIONS.map((number) => `measured_${number}`);
export const PARALLEL_KEYS = ['top', 'middle', 'bottom'];

// "± 0.02 mm RDG" -> 0.02
export const parseTolerance = (v) => {
  const m = String(v ?? '').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

const num = (v) => (v === '' || v == null ? NaN : Number(v));
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '');

export const computeRow = (row, tol, keys = MEASURED) => {
  const vals = keys.map((k) => num(row[k]));
  const complete = vals.every(Number.isFinite);
  const avg = complete ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : NaN;
  const spec = num(row.specified);
  const ok = Number.isFinite(spec) && Number.isFinite(tol);
  const lower = ok ? spec - tol : NaN;
  const upper = ok ? spec + tol : NaN;
  const pass = complete && ok ? avg >= lower - 1e-9 && avg <= upper + 1e-9 : null;
  return { average: f2(avg), lower: f2(lower), upper: f2(upper), disposition: pass === null ? '' : pass ? 'PASSED' : 'FAILED' };
};

/* ============================================================================
   Default data
   ----------------------------------------------------------------------------
   Every equipment type except the caliper keeps its readings in `inputs`
   ({ fieldId: value }).  The fields, their defaults and their table layout come
   from that equipment's mapping JSON (server/report-engine/mappings/<key>.json),
   so adding a template never needs a change in this file.
   ============================================================================ */
const STANDARD_BLANK = { equipment_type: '', maker_model: '', control_number: '', serial_number: '', accuracy: '', calibrated_by: '', traceability: '', certificate_number: '' };

export const createScaleLupeData = (snapshot = {}) => ({
  template: 'standard',
  temperature: '', humidity: '',
  verification_method: 'Nikkoshi standard verification procedure (NPPI-1101-5-000-033)',
  equipment_accuracy: '', required_accuracy: '', range: '', status: '', application_limit: '',
  standard_equipment: { ...STANDARD_BLANK },
  stabilization: { time_start: '', time_end: '', temp_start: '', temp_end: '' },
  inputs: {},
  measurement_sections: [], x_points: [], y_points: [],      // kept empty: older saved reports still load
  physical_condition: 'No damage or alteration observed', verification_result: '', result_note: '', equipment_issued_to: '',
  ...snapshot,
});

const CAL_POINTS = [['1', 1], ['1.5', 1.5], ['1 + 1.5', 2.5], ['5', 5], ['5 + 2', 7], ['10', 10], ['15', 15], ['25', 25], ['40', 40], ['40 + 20', 60], ['50 + 20', 70]];
const blankRow = (gauge, specified) => ({ gauge, specified: specified === '' ? '' : Number(specified).toFixed(2), ...Object.fromEntries(MEASURED.map((k) => [k, ''])) });
const rowsOf = (list) => list.map(([g, s]) => blankRow(g, s));

export const createCaliperData = (snapshot = {}) => ({
  template: 'caliper',
  temperature: '', humidity: '',
  verification_method: 'The equipment was verified according to Nikkoshi standard verification procedure (NPPI-1101-5-000-027) using standard equipment that is traceable to National/International Standards under the environmental condition stated above.',
  equipment_accuracy: '', required_accuracy: '', range: '', status: '',
  standard_equipment: { ...STANDARD_BLANK },
  stabilization: { time_start: '', time_end: '', temp_start: '', temp_end: '' },
  measurement_sections: [
    { title: 'External Measurement (mm)', rows: rowsOf([...CAL_POINTS, ['100', 100]]) },
    { title: 'Internal Measurement (mm)', rows: rowsOf(CAL_POINTS) },
    { title: 'Step Measurement (mm)', rows: rowsOf(CAL_POINTS) },
    { title: 'Depth Measurement (mm)', rows: rowsOf(CAL_POINTS) },
  ],
  parallelism: [
    { measurement: 'External Jaw', gauge: '10', specified: '10.00', top: '', middle: '', bottom: '' },
    { measurement: 'Internal Jaw', gauge: '10', specified: '10.00', top: '', middle: '', bottom: '' },
  ],
  x_points: [], y_points: [],
  physical_condition: 'No physical defect or alteration observed',
  verification_result: '', result_scope: '', result_note: 'All measured value are within control limit',
  equipment_issued_to: '',
  ...snapshot,
});

const hasReadings = (data) =>
  [...(data.x_points || []), ...(data.y_points || []), ...(data.measurement_sections || []).flatMap((s) => s.rows || []), ...(data.parallelism || [])]
    .some((row) => [...MEASURED, ...PARALLEL_KEYS].some((k) => row[k] !== undefined && row[k] !== ''));

/* ============================================================================
   Keyboard in the tables (like a spreadsheet)
     Enter / Shift+Enter  next / previous box (continues into the next table)
     Arrow Up / Down      same column, row above / below
     Arrow Left / Right   previous / next box - only when the caret is at the edge of the text, so editing is not disturbed
   A box selects its whole text when it gets focus, so typing replaces the old number.
   ============================================================================ */
const gridBoxes = (root) => [...root.querySelectorAll('input[data-grid]')].filter((i) => !i.disabled && !i.readOnly && i.offsetParent !== null);

function gridKeyDown(e) {
  if (e.nativeEvent?.isComposing) return;
  const el = e.currentTarget;
  const root = el.closest('[data-grid-root]') || document;
  const boxes = gridBoxes(root);
  const at = boxes.indexOf(el);
  const go = (target) => { if (target) { e.preventDefault(); target.focus(); } };
  if (e.key === 'Enter') { e.preventDefault(); go(boxes[at + (e.shiftKey ? -1 : 1)]); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const tr = el.closest('tr'), td = el.closest('td');
    const next = tr && (e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling);
    const cell = next && next.cells[td ? td.cellIndex : 0];
    go(cell && [...cell.querySelectorAll('input[data-grid]')].find((i) => !i.disabled && !i.readOnly));
    return;
  }
  const len = el.value.length, a = el.selectionStart, b = el.selectionEnd;
  const whole = a === 0 && b === len;                                       // focused by keyboard: all selected
  if (e.key === 'ArrowRight' && (whole || (a === len && b === len))) go(boxes[at + 1]);
  if (e.key === 'ArrowLeft' && (whole || (a === 0 && b === 0))) go(boxes[at - 1]);
}
const gridProps = { 'data-grid': '1', onKeyDown: gridKeyDown, onFocus: (e) => e.target.select() };

/* ============================================================================
   Template helpers
   ============================================================================ */
const normText = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// longest matching keyword wins:  "pocket weighing scale"  beats  "weighing scale";  "laser micrometer"  beats  "micrometer"
function pickTemplate(templates, equipment) {
  const code = normText(equipment?.equipment_code).replace(/ /g, '');         // a unit with its own template (HP0001RE) wins over any keyword
  if (code) { const own = templates.find((t) => normText(t.key).replace(/ /g, '') === code); if (own) return own.key; }
  const identity = ` ${normText([equipment?.equipment_name, equipment?.category, equipment?.model].filter(Boolean).join(' '))} `;
  let best = null;
  let bestLen = 0;
  for (const t of templates) {
    if (t.per_equipment) continue;                                            // per-equipment templates are matched by control number only
    for (const word of [t.key, t.label, ...(t.match || [])].map(normText).filter(Boolean)) {
      if (identity.includes(` ${word} `) || identity.includes(word)) {
        if (word.length > bestLen) { best = t.key; bestLen = word.length; }
      }
    }
  }
  return best;
}

const fieldsOf = (tpl) => (tpl?.input_groups || []).flatMap((g) => g.fields || []);
const defaultsOf = (tpl) => Object.fromEntries(fieldsOf(tpl).filter((f) => f.default !== undefined).map((f) => [f.id, String(f.default)]));
const hasInputs = (data, tpl) => {
  const defs = defaultsOf(tpl);
  return Object.entries(data.inputs || {}).some(([k, v]) => v !== '' && v != null && String(v) !== (defs[k] ?? ''));
};

/* ============================================================================
   One group of inputs of a template: drawn as a table (row x column) when the
   mapping gives every field a `row` and `col`, otherwise as a plain list.
   ============================================================================ */
const thBase = 'px-2 py-1.5 font-semibold leading-tight border-r last:border-r-0';

function InputGroup({ group, inputs, onChange, disabled }) {
  const fields = group.fields || [];
  const tabular = fields.length > 0 && fields.every((f) => f.row && f.col);

  const control = (f, compact) => (
    <Input
      type="text"
      inputMode={f.type === 'number' ? 'decimal' : 'text'}
      value={inputs?.[f.id] ?? ''}
      onChange={(e) => onChange(f.id, e.target.value)}
      disabled={disabled}
      aria-label={f.label}
      title={f.label}
      {...gridProps}
      className={compact ? 'h-8 min-w-[4.5rem] px-1.5 text-[11px]' : undefined}
    />
  );

  if (!tabular) {
    return (
      <div className="rounded-lg border p-4 space-y-4">
        <p className="eyebrow">{group.title}</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.id} className="space-y-1"><Label className="text-[11px]">{f.label}</Label>{control(f, false)}</div>
          ))}
        </div>
      </div>
    );
  }

  const rows = [];
  const cols = [];
  const cells = new Map();
  fields.forEach((f) => {
    if (!rows.includes(f.row)) rows.push(f.row);
    if (!cols.includes(f.col)) cols.push(f.col);
    cells.set(`${f.row}\u0000${f.col}`, f);
  });

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">{group.title}</Label>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${thBase} text-left`} />
              {cols.map((c) => <th key={c} className={`${thBase} text-center`}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className="border-t">
                <td className="px-2 py-1 font-medium leading-tight bg-slate-50/60 min-w-[6rem] max-w-[13rem]">{r}</td>
                {cols.map((c) => {
                  const f = cells.get(`${r}\u0000${c}`);
                  return <td key={c} className="px-1 py-1">{f ? control(f, true) : null}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================================
   Caliper sections editor (External / Internal / Step / Depth / Parallelism)
   ============================================================================ */
const th = 'px-2 py-1 text-center font-semibold border-r last:border-r-0';

function CaliperSections({ data, setData, disabled }) {
  const tol = parseTolerance(data.required_accuracy || data.equipment_accuracy);
  const sections = data.measurement_sections || [];
  const parallel = data.parallelism || [];
  const stab = data.stabilization || {};

  const setSections = (next) => setData('measurement_sections', next);
  const setCell = (si, ri, key, value) => setSections(sections.map((s, i) => (i !== si ? s : { ...s, rows: s.rows.map((r, j) => (j !== ri ? r : { ...r, [key]: value })) })));
  const addRow = (si) => setSections(sections.map((s, i) => (i !== si ? s : { ...s, rows: [...s.rows, blankRow('', '')] })));
  const delRow = (si, ri) => setSections(sections.map((s, i) => (i !== si ? s : { ...s, rows: s.rows.filter((_, j) => j !== ri) })));
  const setPar = (ri, key, value) => setData('parallelism', parallel.map((r, j) => (j !== ri ? r : { ...r, [key]: value })));
  const setStab = (key) => (e) => setData('stabilization', { ...stab, [key]: e.target.value });

  const inp = (value, onChange) => <Input value={value || ''} onChange={onChange} disabled={disabled} className="h-8 text-[11px] px-1.5" {...gridProps} />;
  const dispCls = (d) => (d === 'PASSED' ? 'text-emerald-700' : d === 'FAILED' ? 'text-red-600' : '');

  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4 space-y-4">
        <p className="eyebrow">Equipment Under Test (extra details)</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1"><Label className="text-[11px]">Range</Label><Input value={data.range || ''} onChange={(e) => setData('range', e.target.value)} disabled={disabled} placeholder="0 ~ 150 mm" /></div>
          <div className="space-y-1"><Label className="text-[11px]">Status</Label><Input value={data.status || ''} onChange={(e) => setData('status', e.target.value)} disabled={disabled} placeholder="Partial / Full" /></div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <p className="eyebrow">Stabilization Details</p>
        <div className="grid sm:grid-cols-4 gap-4">
          <div className="space-y-1"><Label className="text-[11px]">Time — Start</Label><Input value={stab.time_start || ''} onChange={setStab('time_start')} disabled={disabled} placeholder="8:30 AM" /></div>
          <div className="space-y-1"><Label className="text-[11px]">Time — End</Label><Input value={stab.time_end || ''} onChange={setStab('time_end')} disabled={disabled} placeholder="9:35 AM" /></div>
          <div className="space-y-1"><Label className="text-[11px]">Temp (°C) — Start</Label><Input value={stab.temp_start || ''} onChange={setStab('temp_start')} disabled={disabled} /></div>
          <div className="space-y-1"><Label className="text-[11px]">Temp (°C) — End</Label><Input value={stab.temp_end || ''} onChange={setStab('temp_end')} disabled={disabled} /></div>
        </div>
      </div>

      {sections.map((section, si) => (
        <div key={section.title} className="space-y-2">
          <Label className="text-xs font-semibold">{section.title}</Label>
          <div className="overflow-x-auto border rounded-lg">
            {/* fixed layout + % widths: the table always fits its box; only a phone-sized screen scrolls */}
            <table className="w-full table-fixed text-[11px] min-w-[560px] sm:min-w-0">
              <colgroup>
                <col style={{ width: '9%' }} /><col style={{ width: '10%' }} />
                {REPETITIONS.map((n) => <col key={n} style={{ width: '9%' }} />)}
                <col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '4%' }} />
              </colgroup>
              <thead className="bg-slate-50">
                <tr>
                  <th className={th} title="Gauge block used">Gauge</th><th className={th} title="Equivalent value">Equiv.</th>
                  {REPETITIONS.map((n) => <th key={n} className={th}>{n}</th>)}
                  <th className={th} title="Average">Avg</th><th className={th} title="Lower control limit">Lower</th><th className={th} title="Upper control limit">Upper</th><th className={th} title="Disposition">Result</th><th />
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, ri) => {
                  const c = computeRow(row, tol);
                  return (
                    <tr key={ri} className="border-t">
                      <td className="px-1 py-1">{inp(row.gauge, (e) => setCell(si, ri, 'gauge', e.target.value))}</td>
                      <td className="px-1 py-1">{inp(row.specified, (e) => setCell(si, ri, 'specified', e.target.value))}</td>
                      {MEASURED.map((k) => <td key={k} className="px-1 py-1">{inp(row[k], (e) => setCell(si, ri, k, e.target.value))}</td>)}
                      <td className="px-1 py-1 font-mono text-center">{c.average || '—'}</td>
                      <td className="px-1 py-1 font-mono text-center">{c.lower || '—'}</td>
                      <td className="px-1 py-1 font-mono text-center">{c.upper || '—'}</td>
                      <td className={`px-1 py-1 text-center font-semibold ${dispCls(c.disposition)}`}>{c.disposition || '—'}</td>
                      <td className="px-0.5 text-center">{!disabled && <button type="button" onClick={() => delRow(si, ri)} className="p-0 leading-none text-slate-400 hover:text-red-600" aria-label="Delete row"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!disabled && <Button type="button" variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => addRow(si)}><Plus className="h-3.5 w-3.5" />Add row</Button>}
        </div>
      ))}

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Parallelism (mm)</Label>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full table-fixed text-[11px] min-w-[560px] sm:min-w-0">
            <colgroup>
              <col style={{ width: '9%' }} /><col style={{ width: '10%' }} /><col style={{ width: '16%' }} />
              <col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead className="bg-slate-50">
              <tr><th className={th} title="Gauge block used">Gauge</th><th className={th} title="Equivalent value">Equiv.</th><th className={th}>Measurement</th><th className={th}>Top</th><th className={th}>Middle</th><th className={th}>Bottom</th><th className={th} title="Average">Avg</th><th className={th} title="Lower control limit">Lower</th><th className={th} title="Upper control limit">Upper</th><th className={th} title="Disposition">Result</th></tr>
            </thead>
            <tbody>
              {parallel.map((row, ri) => {
                const c = computeRow(row, tol, PARALLEL_KEYS);
                return (
                  <tr key={ri} className="border-t">
                    <td className="px-1 py-1">{inp(row.gauge, (e) => setPar(ri, 'gauge', e.target.value))}</td>
                    <td className="px-1 py-1">{inp(row.specified, (e) => setPar(ri, 'specified', e.target.value))}</td>
                    <td className="px-1 py-1">{inp(row.measurement, (e) => setPar(ri, 'measurement', e.target.value))}</td>
                    {PARALLEL_KEYS.map((k) => <td key={k} className="px-1 py-1">{inp(row[k], (e) => setPar(ri, k, e.target.value))}</td>)}
                    <td className="px-1 py-1 font-mono text-center">{c.average || '—'}</td>
                    <td className="px-1 py-1 font-mono text-center">{c.lower || '—'}</td>
                    <td className="px-1 py-1 font-mono text-center">{c.upper || '—'}</td>
                    <td className={`px-1 py-1 text-center font-semibold ${dispCls(c.disposition)}`}>{c.disposition || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <p className="eyebrow">Verification Result Details</p>
        <div className="space-y-1"><Label className="text-[11px]">Scope (e.g. 0-100 mm external measurement, 0-70 mm internal, depth, step measurement)</Label><Textarea rows={2} value={data.result_scope || ''} onChange={(e) => setData('result_scope', e.target.value)} disabled={disabled} /></div>
        <div className="space-y-1"><Label className="text-[11px]">Result Note</Label><Input value={data.result_note || ''} onChange={(e) => setData('result_note', e.target.value)} disabled={disabled} /></div>
      </div>
    </div>
  );
}

function Notice({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      <Info className="h-4 w-4 mt-0.5 shrink-0" /><div>{children}</div>
    </div>
  );
}

/* ============================================================================
   Main form
   ============================================================================ */
export default function ReportFormFields({ form, setForm, disabled, isAdmin, error, standardEquipment = [], equipment }) {
  const [templates, setTemplates] = useState([]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const data = form.report_data || createScaleLupeData();
  const isCaliper = data.template === 'caliper';

  const configuredTemplates = templates.filter((t) => t.mapping_configured && t.template_exists);
  const activeTemplateKey = configuredTemplates.some((t) => t.key === form.report_template)
    ? form.report_template
    : pickTemplate(configuredTemplates, equipment) || (isCaliper ? 'caliper' : '');
  const activeTemplate = configuredTemplates.find((t) => t.key === activeTemplateKey);

  // functional updates: several fields can change in the same tick without overwriting each other
  const setData = (key, value) => setForm((f) => ({ ...f, report_data: { ...(f.report_data || data), [key]: value } }));
  const setNested = (key, sub, value) => setForm((f) => {
    const d = f.report_data || data;
    return { ...f, report_data: { ...d, [key]: { ...(d[key] || {}), [sub]: value } } };
  });
  const setStandard = (key) => (e) => setNested('standard_equipment', key, e.target.value);
  const setStab = (key) => (e) => setNested('stabilization', key, e.target.value);
  const setInput = (id, value) => setNested('inputs', id, value);

  useEffect(() => {
    let live = true;
    apiClient.reports.templates().then((items) => { if (live) setTemplates(items); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // remember which template this report uses (the server reads report_template when it builds the Excel / PDF)
  useEffect(() => {
    if (!form.report_template && activeTemplateKey) {
      setForm((current) => ({ ...current, report_template: activeTemplateKey, report_data: { ...current.report_data, template_key: activeTemplateKey } }));
    }
  }, [activeTemplateKey, form.report_template, setForm]);

  // pre-fill the template's default values (standard weights, test points, ...) without touching what was already typed
  useEffect(() => {
    if (!activeTemplate || isCaliper || disabled) return;
    const defs = defaultsOf(activeTemplate);
    if (!Object.keys(defs).length) return;
    setForm((current) => {
      const saved = Object.fromEntries(Object.entries(current.report_data?.inputs || {}).filter(([, v]) => v !== '' && v != null));
      return { ...current, report_data: { ...current.report_data, inputs: { ...defs, ...saved } } };
    });
  }, [activeTemplate?.key, disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchTemplate = (tpl) => {
    if (tpl === activeTemplateKey) return;
    if ((hasReadings(data) || hasInputs(data, activeTemplate)) && !window.confirm('Changing the template will clear the measurements you entered. Continue?')) return;
    const carry = {
      temperature: data.temperature, humidity: data.humidity,
      equipment_accuracy: data.equipment_accuracy, required_accuracy: data.required_accuracy,
      range: data.range, status: data.status,
      standard_equipment: data.standard_equipment, equipment_issued_to: data.equipment_issued_to,
    };
    const next = configuredTemplates.find((t) => t.key === tpl);
    const nextData = tpl === 'caliper' ? createCaliperData(carry) : createScaleLupeData({ ...carry, inputs: defaultsOf(next) });
    setForm((f) => ({ ...f, report_template: tpl, report_data: { ...nextData, template_key: tpl } }));
  };

  const applyStandard = (controlNumber) => {
    const selected = standardEquipment.find((standard) => standard.control_number === controlNumber);
    if (!selected) return;
    setData('standard_equipment', {
      ...data.standard_equipment,
      equipment_type: selected.equipment_type || '',
      maker_model: selected.maker_model || '',
      control_number: selected.control_number || '',
      serial_number: selected.serial_number || '',
      accuracy: selected.accuracy || '',
      calibrated_by: selected.calibrated_by || '',
      traceability: selected.traceability || '',
      certificate_number: selected.certificate_number || '',
      range: selected.range || '',
    });
  };

  const field = (label, value, onChange, hint) => (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input value={value || ''} onChange={onChange} disabled={disabled} />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );

  // hints that depend on how the chosen template reads "Required Accuracy"
  const ra = activeTemplate?.required_accuracy_cells;
  const accuracyHint = Array.isArray(ra) ? 'This template needs two values, e.g. ± 0.5 mm / ± 0.02 inch'
    : ra?.percent ? 'Include the %, e.g. ± 1% rdg' : '';

  const groups = activeTemplate?.input_groups || [];
  const ownStabilization = groups.some((g) => /stabilization/i.test(g.title));   // Thermohygrometer has 3 locations
  const showAppLimit = !activeTemplate?.header?.application_limit_is_formula;

  return (
    <div className="space-y-5" data-grid-root>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Report Number</Label>
          <Input value={form.report_number} onChange={set('report_number')} disabled={disabled || !isAdmin} className={`font-mono ${error ? 'border-red-400' : ''}`} />
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>
        <div className="space-y-1.5"><Label className="text-xs">Verification Date</Label><Input type="date" value={form.verification_date || ''} onChange={set('verification_date')} disabled={disabled} /></div>
      </div>

      <div className="rounded-lg border bg-blue-50/40 p-4 space-y-2">
        <p className="eyebrow">Report Template</p>
        <Select value={activeTemplate ? activeTemplateKey : undefined} onValueChange={switchTemplate} disabled={disabled}>
          <SelectTrigger className="h-9 text-xs max-w-sm"><SelectValue placeholder="Choose a template">{activeTemplate?.label}</SelectValue></SelectTrigger>
          <SelectContent>
            {configuredTemplates.filter((t) => !t.per_equipment || t.key === activeTemplateKey).map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-slate-50/70 p-4 space-y-4"><p className="eyebrow">Environmental Conditions</p><div className="grid sm:grid-cols-2 gap-4">{field('Temperature (°C)', data.temperature, (e) => setData('temperature', e.target.value))}{field('Humidity (%)', data.humidity, (e) => setData('humidity', e.target.value), 'Whole number, e.g. 55')}</div></div>
      <div className="rounded-lg border p-4 space-y-4"><p className="eyebrow">Equipment Accuracy</p><div className="grid sm:grid-cols-2 gap-4">{field('Equipment Accuracy', data.equipment_accuracy, (e) => setData('equipment_accuracy', e.target.value))}{field('Required Accuracy / Tolerance', data.required_accuracy, (e) => setData('required_accuracy', e.target.value), accuracyHint)}</div></div>
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="eyebrow">Standard Equipment Details</p>
          {standardEquipment.length > 0 && (
            <div className="w-full max-w-xs">
              <Label className="text-[11px]">Choose Standard</Label>
              <Select value={data.standard_equipment?.control_number || 'none'} onValueChange={(value) => value === 'none' ? setData('standard_equipment', { ...STANDARD_BLANK }) : applyStandard(value)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose Standard" /></SelectTrigger>
                <SelectContent className="min-w-[18rem]">
                  <SelectItem value="none">Clear selection</SelectItem>
                  {standardEquipment.map((standard) => (
                    <SelectItem key={standard.id || standard.control_number || `${standard.equipment_type}-${standard.serial_number}`} value={standard.control_number || ''}>
                      {standard.equipment_type || 'Standard'} · {standard.control_number || standard.serial_number || 'No control no.'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">{field('Equipment Type', data.standard_equipment?.equipment_type, setStandard('equipment_type'))}{field('Maker / Model', data.standard_equipment?.maker_model, setStandard('maker_model'))}{field('NIPHCO Control Number', data.standard_equipment?.control_number, setStandard('control_number'))}{field('Serial Number', data.standard_equipment?.serial_number, setStandard('serial_number'))}{field('Equipment Accuracy', data.standard_equipment?.accuracy, setStandard('accuracy'))}{field('Calibrated By', data.standard_equipment?.calibrated_by, setStandard('calibrated_by'))}{field('Traceability', data.standard_equipment?.traceability, setStandard('traceability'))}{field('Calibration Certificate No.', data.standard_equipment?.certificate_number, setStandard('certificate_number'))}</div>
      </div>
      <div className="rounded-lg border p-4 space-y-4"><p className="eyebrow">Verification Method</p><Textarea rows={3} value={data.verification_method || ''} onChange={(e) => setData('verification_method', e.target.value)} disabled={disabled} /></div>

      {/* ------------------------------------------------------------ this equipment's own measurement tables */}
      {isCaliper ? (
        <CaliperSections data={data} setData={setData} disabled={disabled} />
      ) : activeTemplate ? (
        <>
          <div className="rounded-lg border p-4 space-y-4">
            <p className="eyebrow">Equipment Under Test (extra details)</p>
            <div className={`grid gap-4 ${showAppLimit ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {field('Range', data.range, (e) => setData('range', e.target.value))}
              {field('Status', data.status, (e) => setData('status', e.target.value), 'Partial / Full')}
              {showAppLimit && field('Application Limit', data.application_limit, (e) => setData('application_limit', e.target.value))}
            </div>
          </div>

          {!ownStabilization && (
            <div className="rounded-lg border p-4 space-y-4">
              <p className="eyebrow">Stabilization Details</p>
              <div className="grid sm:grid-cols-4 gap-4">
                {field('Time — Start', data.stabilization?.time_start, setStab('time_start'))}
                {field('Time — End', data.stabilization?.time_end, setStab('time_end'))}
                {field('Temp (°C) — Start', data.stabilization?.temp_start, setStab('temp_start'))}
                {field('Temp (°C) — End', data.stabilization?.temp_end, setStab('temp_end'))}
              </div>
            </div>
          )}

          {groups.map((group) => <InputGroup key={group.title} group={group} inputs={data.inputs} onChange={setInput} disabled={disabled} />)}
        </>
      ) : (
        <Notice>No Excel template is set up for this equipment type yet. Choose a template above, or ask the administrator to add a mapping for it.</Notice>
      )}

      {activeTemplate && (
        <ReportAttachments
          reportId={form.id}
          slot={activeTemplate.default_attachment_slot || 'sheet'}
          primary={!isCaliper && groups.length === 0}
          disabled={disabled || ['submitted', 'reviewed', 'approved'].includes(form.status)}
        />
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {field('Physical Condition', data.physical_condition, (e) => setData('physical_condition', e.target.value))}
        {field('Verification Result', data.verification_result, (e) => setData('verification_result', e.target.value))}
        {field('Equipment Issued To', data.equipment_issued_to, (e) => setData('equipment_issued_to', e.target.value))}
        {activeTemplate && !isCaliper && field('Result Note', data.result_note, (e) => setData('result_note', e.target.value))}
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Remarks</Label><Textarea rows={3} value={form.remarks || ''} onChange={set('remarks')} disabled={disabled} /></div>
      <div className="grid sm:grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
        <div className="space-y-1.5"><Label className="text-xs">Checked By</Label><Input value={form.checked_by || ''} onChange={set('checked_by')} disabled={disabled} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Reviewed By</Label><Input value={form.reviewed_by || ''} onChange={set('reviewed_by')} disabled={disabled} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Approved By</Label><Input value={form.approved_by || ''} onChange={set('approved_by')} disabled={disabled} /></div>
      </div>
    </div>
  );
}
