import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowUpRight, Check, ClipboardCheck, Loader2, Printer, Search, SearchX, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';
import { logAudit } from '@/lib/audit';
import { useCalibrationData, useExternalCalibrations, useInvalidate, useMe } from '@/hooks/useCalData';
import { fmtDate, isExternalCalibration, STATUS_META } from '@/lib/calibration';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import ExternalCalibrationWorkflowDialog from '@/components/equipment/ExternalCalibrationWorkflowDialog';
const fastDeliveryIcon = new URL('../assets/external-calibration/fast-delivery.webp', import.meta.url).href;
const courierIcon = new URL('../assets/external-calibration/courier.webp', import.meta.url).href;
const doorDeliveryIcon = new URL('../assets/external-calibration/door-delivery.webp', import.meta.url).href;
const clipboardIcon = new URL('../assets/external-calibration/clipboard.webp', import.meta.url).href;

// ─────────────────────────────────────────────────────────────────────────────
// Print form: "External Provider Calibration Check Record" (NPP-1101-F6, Issue 16-1, Rev 1)
// ─────────────────────────────────────────────────────────────────────────────
const NIKKOSHI_LOGO = 'data:image/png;base64,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';
const FORM_ROWS = 8; // item rows on one form
const KNOWN_PROVIDERS = ['PMSi', 'Sonju', 'Arkone', 'Microprecision', 'Shimadzu'];

const CHECK_RECORD_CSS = `
@page { size: A4 portrait; margin: 8mm; }
.crp-copy{box-sizing:border-box;width:194mm;border:0.4mm solid #000;font-family:Arial,Helvetica,sans-serif;font-size:7pt;line-height:1.2;color:#000;background:#fff}
.crp-copy table{border-collapse:collapse;width:100%;table-layout:fixed}
.crp-copy td,.crp-copy th{padding:0;vertical-align:middle}
.crp-head td{height:9.5mm;border-bottom:0.3mm solid #000}
.crp-logo{height:7.5mm;width:auto;display:block;margin:0 2mm}
.crp-company{font-size:11.5pt;font-weight:700;white-space:nowrap}
.crp-copy .crp-title{font-size:9pt;font-weight:700;text-align:right;padding-right:4mm}
.crp-grid th,.crp-grid td{border:0.25mm solid #000;text-align:center;font-size:6.3pt;padding:0 0.8mm;overflow:hidden}
.crp-grid th{font-weight:700;height:4.6mm;background:#fff}
.crp-grid td{height:5.3mm}
.crp-note{font-size:5.8pt;font-style:italic;padding:0.6mm 2mm 0;line-height:1.25}
.crp-blue{color:#1d4ed8}
.crp-sec{border-top:0.3mm solid #000;padding:1mm 2mm 0}
.crp-h{font-weight:700;font-size:6.5pt}
.crp-circle{display:inline-block;width:3.7mm;height:3.7mm;line-height:3.5mm;border:0.25mm solid #1d4ed8;border-radius:50%;text-align:center;color:#1d4ed8;font-weight:700;font-size:6pt;margin-right:1mm}
.crp-cb{display:inline-block;width:3.2mm;height:3.2mm;border:0.3mm solid #000;vertical-align:middle;margin:0 1mm 0 2mm;box-sizing:border-box}
.crp-cb.on{background:#000}
.crp-sign td{vertical-align:top;padding-right:2mm}
.crp-signlabel{height:5mm;font-size:6pt;line-height:1.2;overflow:hidden}
.crp-signgap{height:3.5mm}
.crp-line{margin-top:0.8mm;font-size:6pt;white-space:nowrap}
.crp-line i{display:inline-block;width:66%;border-bottom:0.25mm solid #000;height:2.6mm;vertical-align:bottom;margin-left:1mm}
.crp-foot td{font-size:6pt;font-weight:700;padding:1.2mm 2mm 0}
.crp-cut{width:194mm;height:3mm;border-bottom:0.25mm dashed #94a3b8;margin-bottom:3mm}
.crp-page{width:194mm;margin:0 auto 6mm}
@media screen{.crp-page{background:#fff;padding:0;box-shadow:0 1px 6px rgba(0,0,0,.25)}}
@media print{
  html,body{background:#fff!important}
  body > *:not(.crp-root){display:none!important}
  .crp-root{position:static!important;inset:auto!important;overflow:visible!important;background:#fff!important;padding:0!important}
  .crp-controls{display:none!important}
  .crp-page{margin:0;box-shadow:none;break-after:page;page-break-after:always}
  .crp-page:last-child{break-after:auto;page-break-after:auto}
}
`;

const clean = (v) => (String(v ?? '').trim() && String(v).trim().toUpperCase() !== 'NA' ? String(v).trim() : '-');
const chunk = (list, size) => { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };
const longDate = (iso) => { const d = iso ? parseISO(iso) : null; return d && isValid(d) ? format(d, 'd-MMM-yy') : ''; };

function Cb({ on }) { return <span className={`crp-cb ${on ? 'on' : ''}`} />; }
function SignBlock({ label, children }) {
  return (
    <td>
      <div className="crp-signlabel">{label}</div>
      <div className="crp-signgap" />
      <div className="crp-line">Name:<i /></div>
      <div className="crp-line">Position:<i /></div>
      {children}
    </td>
  );
}

// One copy of the form (the sheet prints two copies per A4 page).
function CheckRecordForm({ items, provider, dateText, mode }) {
  const rows = Array.from({ length: FORM_ROWS }, (_, i) => items[i] || null);
  const cw = ['3.5%', '16%', '8.5%', '8.5%', '9.5%', '10.5%', '9.5%', '3.7%', '3.7%', '3.7%', '3.7%', '7.2%', '11.5%'];
  return (
    <div className="crp-copy">
      <table className="crp-head"><tbody><tr>
        <td style={{ width: '11mm' }}><img className="crp-logo" src={NIKKOSHI_LOGO} alt="" /></td>
        <td className="crp-company" style={{ width: '72mm' }}>NIKKOSHI PHILIPPINES CORPORATION</td>
        <td className="crp-title">EXTERNAL PROVIDER CALIBRATION CHECK RECORD</td>
      </tr></tbody></table>

      <table className="crp-grid">
        <colgroup>{cw.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead>
          <tr>
            <th rowSpan={2}>Item</th><th colSpan={5}>Equipment Details</th><th rowSpan={2}>Calibration Range<sup>1</sup></th>
            <th colSpan={2}>Initial Condition</th><th colSpan={2}>Received Condition</th><th rowSpan={2}>Calibration Cert. (Y/N)</th><th rowSpan={2}><sup>2</sup>Calibration Status details / Remarks</th>
          </tr>
          <tr><th>Equipment Name</th><th>Maker</th><th>Model</th><th>Serial no.</th><th>Control no.</th><th>PHY</th><th>FUN</th><th>PHY</th><th>FUN</th></tr>
        </thead>
        <tbody>
          {rows.map((it, i) => (
            <tr key={i}>
              <td>{it ? i + 1 : ''}</td><td style={{ fontWeight: 700 }}>{it?.name || ''}</td><td>{it ? clean(it.maker) : ''}</td><td>{it ? clean(it.model) : ''}</td>
              <td>{it ? clean(it.serial) : ''}</td><td>{it?.code || ''}</td><td>{it?.range || ''}</td><td>{it?.phy || ''}</td><td>{it?.fun || ''}</td><td /><td /><td /><td />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="crp-note"><sup>1</sup>Calibration Range must tally with the range indicated in the Calibration quotation and must be agreed upon by NIPHCO and the External Provider laboratory.</div>
      <div className="crp-note"><sup>2</sup>Calibration status details includes, but is not limited to, Actual Calibration Range conducted and Additional Recommendation by External Provider laboratory</div>

      <div className="crp-sec" style={{ marginTop: '0.8mm' }}>
        <div><span className="crp-h">EQUIPMENT CONDITION</span> (Please select from the choices below to fill in the column above)</div>
        <table style={{ marginTop: '0.8mm' }}><tbody><tr>
          <td style={{ width: '50%', textAlign: 'center' }}>
            <div className="crp-h">Physical Condition</div>
            <div style={{ marginTop: '0.8mm' }}><span className="crp-circle">1</span>- No Physical Damage observed <span style={{ display: 'inline-block', width: '5mm' }} /><span className="crp-circle">2</span>- With Physical Damage observed</div>
          </td>
          <td style={{ width: '50%', textAlign: 'center' }}>
            <div className="crp-h">Functional Condition</div>
            <div style={{ marginTop: '0.8mm' }}><span className="crp-circle">A</span>- No Functional damage / issue <span style={{ display: 'inline-block', width: '5mm' }} /><span className="crp-circle">B</span>- With Functional damage / issues</div>
          </td>
        </tr></tbody></table>
      </div>

      <div className="crp-sec" style={{ marginTop: '1mm' }}>
        <div><span className="crp-h">EQUIPMENT ISSUANCE DETAILS :</span><Cb on={mode === 'pickup'} />Pick-up<Cb on={mode === 'deliver'} />Deliver</div>
        <table className="crp-sign" style={{ marginTop: '0.5mm' }}><colgroup><col style={{ width: '21%' }} /><col style={{ width: '21%' }} /><col style={{ width: '29%' }} /><col style={{ width: '29%' }} /></colgroup><tbody><tr>
          <SignBlock label="Issued by (Nikkoshi Representative):" />
          <SignBlock label="Approved by:" />
          <SignBlock label="Received by (External Provider Representative):" />
          <td style={{ paddingTop: '1.5mm' }}>
            <div className="crp-line" style={{ whiteSpace: 'normal' }}>Name of <span className="crp-blue">External Provider</span> Laboratory : <b>{provider}</b></div>
            <div className="crp-line" style={{ whiteSpace: 'normal' }}>Date Issued to <span className="crp-blue">External Provider</span> Laboratory : <b style={{ whiteSpace: 'nowrap' }}>{dateText}</b></div>
          </td>
        </tr></tbody></table>
      </div>

      <div className="crp-sec" style={{ marginTop: '1mm' }}>
        <div><span className="crp-h">EQUIPMENT RETRIEVAL DETAILS :</span><Cb on={false} />Pick-up<Cb on={false} />Deliver</div>
        <table className="crp-sign" style={{ marginTop: '0.5mm' }}><colgroup><col style={{ width: '21%' }} /><col style={{ width: '21%' }} /><col style={{ width: '29%' }} /><col style={{ width: '29%' }} /></colgroup><tbody><tr>
          <SignBlock label={<>Issued by (<span className="crp-blue">External Provider</span> Representative):</>} />
          <SignBlock label="Received by (Nikkoshi Representative):" />
          <SignBlock label="Approved by:" />
          <td style={{ paddingTop: '8.6mm' }}><div className="crp-line">Date Returned to NIPHCO: ______________</div></td>
        </tr></tbody></table>
      </div>

      <table className="crp-foot"><tbody><tr><td style={{ textAlign: 'center', width: '88%' }}>Issue No.: 16-1 &nbsp;&nbsp; Rev. No.: 1</td><td style={{ textAlign: 'right' }}>NPP-1101-F6</td></tr></tbody></table>
    </div>
  );
}

function CheckRecordDialog({ rows, providers, defaultDate, onClose }) {
  const commonProvider = useMemo(() => {
    const names = new Set(rows.map((r) => r.cycle?.provider).filter(Boolean));
    return names.size === 1 ? [...names][0] : '';
  }, [rows]);
  const [provider, setProvider] = useState(commonProvider);
  const [date, setDate] = useState(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [mode, setMode] = useState('pickup');
  const [copies, setCopies] = useState(2);
  const [edits, setEdits] = useState({});
  const setEdit = (id, patch) => setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = rows.map((r) => ({ id: r.id, code: r.equipment_code, name: r.equipment_name, maker: r.manufacturer, model: r.model, serial: r.serial_number, range: 'FULL SCALE', phy: r.crp?.phy || '1', fun: r.crp?.fun || 'A', ...edits[r.id] }));
  const pages = chunk(items, FORM_ROWS);
  const providerOptions = [...new Set([...KNOWN_PROVIDERS, ...providers])];
  const field = 'h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring';

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="crp-root fixed inset-0 z-[100] overflow-auto bg-slate-900/60 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Print check record">
      <style>{CHECK_RECORD_CSS}</style>
      <div className="crp-controls mx-auto mb-5 max-w-[820px] rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">Print Check Record</p>
            <p className="text-xs text-muted-foreground">External Provider Calibration Check Record · NPP-1101-F6 · {items.length} {items.length === 1 ? 'equipment' : 'equipment'}{pages.length > 1 ? ` · prints as ${pages.length} forms (8 items each)` : ''}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs space-y-1 block"><span className="text-muted-foreground">External provider laboratory</span>
            <input list="crp-providers" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="e.g. PMSi" className={`${field} w-full`} />
            <datalist id="crp-providers">{providerOptions.map((name) => <option key={name} value={name} />)}</datalist>
          </label>
          <label className="text-xs space-y-1 block"><span className="text-muted-foreground">Date issued</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`${field} w-full`} />
          </label>
          <div className="text-xs space-y-1"><span className="text-muted-foreground block">Issuance</span>
            <div className="flex h-9 items-center gap-4 text-sm">
              <label className="flex items-center gap-1.5"><input type="radio" name="crp-mode" checked={mode === 'pickup'} onChange={() => setMode('pickup')} />Pick-up</label>
              <label className="flex items-center gap-1.5"><input type="radio" name="crp-mode" checked={mode === 'deliver'} onChange={() => setMode('deliver')} />Deliver</label>
            </div>
          </div>
          <label className="text-xs space-y-1 block"><span className="text-muted-foreground">Copies per page</span>
            <select value={copies} onChange={(event) => setCopies(Number(event.target.value))} className={`${field} w-full`}><option value={2}>2 copies (A4, one on top of the other)</option><option value={1}>1 copy</option></select>
          </label>
        </div>

        <div className="mt-4 rounded-lg border">
          <div className="grid grid-cols-[1fr_150px_64px_64px] gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-medium text-muted-foreground"><span>Equipment</span><span>Calibration range</span><span>PHY</span><span>FUN</span></div>
          <div className="max-h-48 divide-y overflow-y-auto">
            {items.map((it) => (
              <div key={it.id} className="grid grid-cols-[1fr_150px_64px_64px] items-center gap-2 px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate"><span className="font-mono text-xs text-muted-foreground">{it.code}</span> {it.name}</span>
                <input value={it.range} onChange={(event) => setEdit(it.id, { range: event.target.value })} className={`${field} h-8`} aria-label={`Calibration range of ${it.code}`} />
                <select value={it.phy} onChange={(event) => setEdit(it.id, { phy: event.target.value })} className={`${field} h-8`} aria-label={`Initial physical condition of ${it.code}`}><option value="1">1</option><option value="2">2</option></select>
                <select value={it.fun} onChange={(event) => setEdit(it.id, { fun: event.target.value })} className={`${field} h-8`} aria-label={`Initial functional condition of ${it.code}`}><option value="A">A</option><option value="B">B</option></select>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">PHY: 1 = no physical damage, 2 = with damage · FUN: A = no functional issue, B = with issues. Received condition, signatures and names are left blank for handwriting.</p>
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button></div>
        </div>
      </div>

      <div className="overflow-x-auto pb-6">
        {pages.map((page, pageIndex) => (
          <div key={pageIndex} className="crp-page">
            {Array.from({ length: copies }, (_, copyIndex) => (
              <React.Fragment key={copyIndex}>
                {copyIndex > 0 && <div className="crp-cut" />}
                <CheckRecordForm items={page} provider={provider} dateText={longDate(date)} mode={mode} />
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// External Calibration page
// ─────────────────────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'planned', label: 'Planned', color: '#3b82f6', icon: fastDeliveryIcon },
  { key: 'sent', label: 'With Provider', color: '#f59e0b', icon: courierIcon },
  { key: 'returned', label: 'Returned', color: '#f97316', icon: doorDeliveryIcon },
  { key: 'certificate_review', label: 'Certificate Review', color: '#8b5cf6', icon: clipboardIcon },
  { key: 'completed', label: 'Completed', color: '#10b981' }, // no icon: a check mark is used instead
];
const NOT_STARTED_COLOR = '#94a3b8';
const GRID = 'md:grid-cols-[minmax(160px,1.5fr)_minmax(120px,0.9fr)_minmax(170px,1.2fr)_auto]';

const displayStatus = (cycle) => cycle?.status === 'returned' && cycle.certificate_file && cycle.calibration_date && cycle.calibration_result && cycle.certificate_number ? 'certificate_review' : cycle?.status;
const stageIndex = (cycle) => STAGES.findIndex((stage) => stage.key === displayStatus(cycle));
const isActive = (row) => !!row.cycle && row.cycle.status !== 'completed';
// Needs action: expired, near expiration or for verify - or any cycle that is still in progress, so it never disappears from the list.
const needsAction = (row) => ['expired', 'due_soon', 'near'].includes(row.status) || isActive(row);

// One row per external-calibration equipment, with its current cycle (an unfinished cycle wins over a completed one).
function buildRows(equipment, cycles) {
  const cycleByEquipment = new Map();
  cycles.slice().sort((a, b) => (b.created_date || '').localeCompare(a.created_date || '')).forEach((cycle) => {
    const current = cycleByEquipment.get(cycle.equipment_id);
    if (!current || (current.status === 'completed' && cycle.status !== 'completed')) cycleByEquipment.set(cycle.equipment_id, cycle);
  });
  return equipment.filter(isExternalCalibration)
    .map((item) => ({ ...item, cycle: cycleByEquipment.get(item.id) || null }))
    .sort((a, b) => (a.next_due || '9999-12-31').localeCompare(b.next_due || '9999-12-31'));
}

function matchesFilter(row, filter) {
  if (filter === 'all') return true;
  if (filter === 'action') return needsAction(row);
  if (filter === 'active') return isActive(row);
  if (filter === 'completed') return row.cycle?.status === 'completed';
  if (filter === 'stage:none') return stageIndex(row.cycle) < 0;
  if (filter.startsWith('stage:')) return displayStatus(row.cycle) === filter.slice(6);
  return true;
}

function matchesQuery(row, query) {
  if (!query) return true;
  return [row.equipment_code, row.equipment_name, row.manufacturer, row.model, row.serial_number, row.department, row.cycle?.provider, row.cycle?.po_number]
    .some((value) => String(value || '').toLowerCase().includes(query));
}

function Stepper({ cycle }) {
  const current = stageIndex(cycle);
  const stage = current >= 0 ? STAGES[current] : null;
  return (
    <div>
      <div className="flex items-center">
        {STAGES.map((s, i) => {
          const done = current >= 0 && i < current;
          const now = i === current;
          const color = now ? s.color : done ? '#64748b' : '#cbd5e1';
          return (
            <React.Fragment key={s.key}>
              <span
                title={s.label}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-white"
                style={{ borderColor: color, background: now ? `${s.color}1a` : '#fff' }}
              >
                {s.icon ? (
                  <img
                    src={s.icon}
                    alt={s.label}
                    className={`h-[18px] w-[18px] object-contain ${now ? '' : done ? 'opacity-60' : 'opacity-30 grayscale'}`}
                    width="18"
                    height="18"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <Check className="h-3.5 w-3.5" style={{ color }} strokeWidth={3} />
                )}
              </span>
              {i < STAGES.length - 1 && <span className="h-[1.5px] min-w-[6px] flex-1" style={{ background: done ? '#64748b' : '#cbd5e1' }} />}
            </React.Fragment>
          );
        })}
      </div>
      <p className="mt-1 text-xs font-medium" style={{ color: stage ? stage.color : NOT_STARTED_COLOR }}>{stage ? stage.label : 'Not Started'}</p>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Batch actions: plan many equipment at once / mark many as sent to the provider
// One cycle is created per equipment, so every item keeps its own status and certificate.
// ─────────────────────────────────────────────────────────────────────────────
const FIELD = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring';
const today = () => format(new Date(), 'yyyy-MM-dd');
const canPlanRow = (row) => !row.cycle || row.cycle.status === 'completed';
const newBatchId = () => `EC-${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const withoutBlanks = (values) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== undefined && value !== null));

function BatchOverlay({ title, subtitle, busy, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-auto bg-slate-900/60 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-[760px] rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><p className="text-lg font-semibold">{title}</p><p className="text-xs text-muted-foreground">{subtitle}</p></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" disabled={busy} onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ResultNote({ error, done, skipped }) {
  if (done) return <span className="text-xs font-medium text-emerald-700">Done</span>;
  if (error) return <span className="text-xs text-red-600" title={error}>Failed: {error}</span>;
  if (skipped) return <span className="text-xs text-muted-foreground">{skipped}</span>;
  return null;
}

// Plan batch: creates one cycle per equipment with the same provider / target send date / PR / PO.
// It sends exactly the fields the single "Start External Calibration" form sends.
function PlanBatchDialog({ rows, providers, me, refresh, onClose, onDone }) {
  const commonProvider = useMemo(() => { const names = new Set(rows.map((r) => r.cycle?.provider).filter(Boolean)); return names.size === 1 ? [...names][0] : ''; }, [rows]);
  const [provider, setProvider] = useState(commonProvider);
  const [date, setDate] = useState(today());
  const [pr, setPr] = useState('');
  const [po, setPo] = useState('');
  const [unticked, setUnticked] = useState(() => new Set());
  const [printAfter, setPrintAfter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState({});
  const [errors, setErrors] = useState({});
  const providerOptions = [...new Set([...KNOWN_PROVIDERS, ...providers])];
  const chosen = rows.filter((r) => canPlanRow(r) && !unticked.has(r.id) && !created[r.id]);
  const failedCount = Object.keys(errors).length;

  const submit = async () => {
    if (!provider.trim()) { toast.error('External provider is required.'); return; }
    if (chosen.length === 0) return;
    setBusy(true);
    const nextCreated = { ...created };
    const nextErrors = {};
    for (const row of chosen) {
      try {
        const cycle = await apiClient.externalCalibrations.create({ equipment_id: row.id, provider: provider.trim(), target_send_date: date, pr_number: pr.trim(), po_number: po.trim() });
        nextCreated[row.id] = cycle?.id ? cycle : { status: 'planned', provider: provider.trim(), po_number: po.trim(), target_send_date: date };
        try { await logAudit(me, { action: 'create', entity_type: 'ExternalCalibration', entity_id: cycle?.id, equipment_id: row.id, entity_label: row.equipment_code, details: `External calibration planned with ${provider.trim()} (batch of ${rows.length})` }); } catch { /* the audit entry is best effort */ }
      } catch (error) {
        nextErrors[row.id] = error?.message || 'Could not create the cycle';
      }
    }
    setCreated(nextCreated);
    setErrors(nextErrors);
    setBusy(false);
    await refresh();
    const failed = Object.keys(nextErrors).length;
    const total = Object.keys(nextCreated).length;
    if (failed === 0) {
      toast.success(`${total} external calibration ${total === 1 ? 'cycle' : 'cycles'} planned`);
      onDone(rows.filter((r) => nextCreated[r.id]).map((r) => ({ ...r, cycle: nextCreated[r.id] })), printAfter, { date });
    } else {
      toast.error(`${failed} could not be planned. The others were created - fix the problem and press the button again for the rest.`);
    }
  };

  return (
    <BatchOverlay title="Plan external calibration" subtitle={`${rows.length} selected · one cycle is created for each equipment and tracked separately`} busy={busy} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">External provider *</span>
          <input list="batch-providers" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="e.g. PMSi" className={FIELD} />
          <datalist id="batch-providers">{providerOptions.map((name) => <option key={name} value={name} />)}</datalist>
        </label>
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">Target send date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={FIELD} /></label>
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">PR number</span><input value={pr} onChange={(event) => setPr(event.target.value)} className={FIELD} /></label>
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">PO number</span><input value={po} onChange={(event) => setPo(event.target.value)} className={FIELD} /></label>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[28px_1fr_90px_minmax(120px,1fr)] gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-medium text-muted-foreground"><span /><span>Equipment</span><span>Due</span><span>Status</span></div>
        <div className="max-h-72 divide-y overflow-y-auto">
          {rows.map((row) => {
            const eligible = canPlanRow(row);
            const meta = STATUS_META[row.status];
            return (
              <div key={row.id} className={`grid grid-cols-[28px_1fr_90px_minmax(120px,1fr)] items-center gap-2 px-3 py-2 text-sm ${eligible ? '' : 'bg-slate-50/70 text-muted-foreground'}`}>
                <input type="checkbox" disabled={!eligible || !!created[row.id] || busy} checked={eligible && !unticked.has(row.id)} aria-label={`Include ${row.equipment_code}`} className="h-4 w-4 rounded border-slate-300"
                  onChange={() => setUnticked((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })} />
                <span className="min-w-0 truncate"><span className="font-mono text-xs">{row.equipment_code}</span> {row.equipment_name}</span>
                <span className="font-mono text-xs">{fmtDate(row.next_due, 'dd MMM')}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  {created[row.id] || errors[row.id] || !eligible
                    ? <ResultNote done={!!created[row.id]} error={errors[row.id]} skipped={!eligible ? 'Already has a cycle in progress - skipped' : ''} />
                    : meta && <><span className="h-[7px] w-[7px] rounded-full" style={{ background: meta.hex }} />{meta.label}</>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={printAfter} onChange={(event) => setPrintAfter(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />Open the check record to print after creating</label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{Object.keys(created).length > 0 ? 'Close' : 'Cancel'}</Button>
          <Button type="button" className="gap-2" disabled={busy || chosen.length === 0} onClick={submit}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{failedCount > 0 ? `Retry ${chosen.length}` : `Create ${chosen.length} ${chosen.length === 1 ? 'cycle' : 'cycles'}`}
          </Button>
        </div>
      </div>
    </BatchOverlay>
  );
}

// Mark as sent: the same "Mark Sent" step as the single form, for many equipment at once.
// The names are the ones signed on the Check Record (Issued by / Approved by / Received by the provider's representative).
const PHY_LABEL = { 1: 'No Physical Damage observed', 2: 'With Physical Damage observed' };
const FUN_LABEL = { A: 'No Functional damage / issue', B: 'With Functional damage / issues' };

function SendBatchDialog({ rows, me, refresh, onClose, onDone }) {
  const [date, setDate] = useState(today());
  const [issuedBy, setIssuedBy] = useState(me?.full_name || '');
  const [approvedBy, setApprovedBy] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [conditions, setConditions] = useState({});
  const [printAfter, setPrintAfter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState({});
  const [errors, setErrors] = useState({});
  const pending = rows.filter((r) => !done[r.id]);
  const conditionOf = (row) => ({ phy: '1', fun: 'A', ...conditions[row.id] });
  const setCondition = (id, patch) => setConditions((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const select = 'h-8 w-full rounded-md border border-input bg-background px-1.5 text-sm outline-none focus:ring-2 focus:ring-ring';

  const submit = async () => {
    if (!date || !issuedBy.trim() || !approvedBy.trim() || !receivedBy.trim()) { toast.error('Complete the date sent and the three sign-off names (Issued by, Approved by, Received by).'); return; }
    setBusy(true);
    const nextDone = { ...done };
    const nextErrors = {};
    for (const row of pending) {
      const cycle = row.cycle;
      const k = conditionOf(row);
      try {
        await apiClient.externalCalibrations.update(cycle.id, {
          provider: cycle.provider || '', target_send_date: cycle.target_send_date || '', pr_number: cycle.pr_number || '', po_number: cycle.po_number || '',
          sent_date: date, initial_physical_condition: PHY_LABEL[k.phy], initial_functional_condition: FUN_LABEL[k.fun],
          issued_by: issuedBy.trim(), approved_by: approvedBy.trim(), provider_received_by: receivedBy.trim(), status: 'sent',
        });
        nextDone[row.id] = true;
        try { await logAudit(me, { action: 'update', entity_type: 'ExternalCalibration', entity_id: cycle.id, equipment_id: row.id, entity_label: row.equipment_code, details: 'Equipment sent to external provider' }); } catch { /* best effort */ }
      } catch (error) {
        nextErrors[row.id] = error?.message || 'Could not update the cycle';
      }
    }
    setDone(nextDone);
    setErrors(nextErrors);
    setBusy(false);
    await refresh();
    const failed = Object.keys(nextErrors).length;
    if (failed === 0) {
      toast.success(`${rows.length} equipment marked as sent to the provider`);
      onDone(rows.map((r) => ({ ...r, cycle: { ...r.cycle, status: 'sent' }, crp: conditionOf(r) })), printAfter, { date });
    } else {
      toast.error(`${failed} could not be updated. The others were marked as sent - press the button again for the rest.`);
    }
  };

  return (
    <BatchOverlay title="Mark as sent to provider" subtitle={`${rows.length} planned ${rows.length === 1 ? 'cycle' : 'cycles'} move to "With Provider" · fill in the names from the signed check record`} busy={busy} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">Date sent / picked up *</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={FIELD} /></label>
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">Issued by (Nikkoshi) *</span><input value={issuedBy} onChange={(event) => setIssuedBy(event.target.value)} className={FIELD} /></label>
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">Approved by *</span><input value={approvedBy} onChange={(event) => setApprovedBy(event.target.value)} className={FIELD} /></label>
        <label className="block space-y-1 text-xs"><span className="text-muted-foreground">Received by (provider representative) *</span><input value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} className={FIELD} /></label>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1fr_minmax(110px,0.7fr)_64px_64px_minmax(70px,0.5fr)] gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-medium text-muted-foreground"><span>Equipment</span><span>Provider</span><span>PHY</span><span>FUN</span><span /></div>
        <div className="max-h-64 divide-y overflow-y-auto">
          {rows.map((row) => {
            const k = conditionOf(row);
            return (
              <div key={row.id} className="grid grid-cols-[1fr_minmax(110px,0.7fr)_64px_64px_minmax(70px,0.5fr)] items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 truncate"><span className="font-mono text-xs">{row.equipment_code}</span> {row.equipment_name}</span>
                <span className="truncate text-xs text-muted-foreground">{row.cycle?.provider || 'No provider'}{row.cycle?.po_number ? ` · PO ${row.cycle.po_number}` : ''}</span>
                <select className={select} value={k.phy} disabled={busy || !!done[row.id]} aria-label={`Initial physical condition of ${row.equipment_code}`} onChange={(event) => setCondition(row.id, { phy: event.target.value })}><option value="1">1</option><option value="2">2</option></select>
                <select className={select} value={k.fun} disabled={busy || !!done[row.id]} aria-label={`Initial functional condition of ${row.equipment_code}`} onChange={(event) => setCondition(row.id, { fun: event.target.value })}><option value="A">A</option><option value="B">B</option></select>
                <ResultNote done={!!done[row.id]} error={errors[row.id]} />
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">PHY: 1 = no physical damage, 2 = with damage · FUN: A = no functional issue, B = with issues (initial condition when it leaves).</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={printAfter} onChange={(event) => setPrintAfter(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />Open the check record to print after marking</label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{Object.keys(done).length > 0 ? 'Close' : 'Cancel'}</Button>
          <Button type="button" className="gap-2" disabled={busy || pending.length === 0} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{Object.keys(errors).length > 0 ? `Retry ${pending.length}` : `Mark ${pending.length} as sent`}</Button>
        </div>
      </div>
    </BatchOverlay>
  );
}

export default function ExternalCalibrations() {
  const { equipment, isLoading: equipmentLoading } = useCalibrationData();
  const { data: cycles = [], isLoading: cyclesLoading, error } = useExternalCalibrations();
  const invalidate = useInvalidate();
  const { data: me } = useMe();
  const canManage = ['admin', 'user', 'sr_staff'].includes(me?.role);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('action');
  const [selected, setSelected] = useState(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [printRows, setPrintRows] = useState(null);
  const [planRows, setPlanRows] = useState(null);
  const [sendRows, setSendRows] = useState(null);
  const [printDate, setPrintDate] = useState(null);

  const allRows = useMemo(() => buildRows(equipment, cycles), [equipment, cycles]);
  const counts = useMemo(() => {
    const c = { all: allRows.length, action: 0, active: 0, completed: 0, none: 0 };
    STAGES.forEach((s) => { c[s.key] = 0; });
    allRows.forEach((row) => {
      if (needsAction(row)) c.action += 1;
      if (isActive(row)) c.active += 1;
      if (row.cycle?.status === 'completed') c.completed += 1;
      const i = stageIndex(row.cycle);
      if (i < 0) c.none += 1; else c[STAGES[i].key] += 1;
    });
    return c;
  }, [allRows]);
  const query = search.trim().toLowerCase();
  const rows = useMemo(() => allRows.filter((row) => matchesFilter(row, filter) && matchesQuery(row, query)), [allRows, filter, query]);
  const providers = useMemo(() => [...new Set(cycles.map((cycle) => cycle.provider).filter(Boolean))], [cycles]);

  const openWorkflow = (row, startNew = false) => { setSelected({ ...row, cycle: startNew ? null : row.cycle }); setWorkflowOpen(true); };
  const closeWorkflow = () => { setWorkflowOpen(false); setSelected(null); };
  const togglePick = (id) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allShownPicked = rows.length > 0 && rows.every((row) => picked.has(row.id));
  const toggleAllShown = () => setPicked((current) => { const next = new Set(current); rows.forEach((row) => { if (allShownPicked) next.delete(row.id); else next.add(row.id); }); return next; });
  const pickedRows = allRows.filter((row) => picked.has(row.id));
  const canPlan = canManage && pickedRows.some(canPlanRow);
  const canSend = canManage && pickedRows.length > 0 && pickedRows.every((row) => row.cycle?.status === 'planned');
  const refreshCycles = async () => { invalidate('equipment', 'external-calibrations'); };
  const finishBatch = (doneRows, print, options) => { setPlanRows(null); setSendRows(null); setPicked(new Set()); if (print && doneRows.length > 0) { setPrintRows(doneRows); setPrintDate(options?.date || null); } };

  if (equipmentLoading || cyclesLoading) return <LoadingState label="Loading external calibration queue…" />;
  if (error) return <div className="panel p-6 text-sm text-red-700">Could not load external calibration records: {error.message}</div>;

  const chips = [['action', 'Needs action', counts.action], ['all', 'All External', counts.all], ['active', 'In Progress', counts.active], ['completed', 'Completed', counts.completed]];
  const tiles = [{ key: 'none', filter: 'stage:none', label: 'Not Started', color: NOT_STARTED_COLOR, n: counts.none }, ...STAGES.map((s) => ({ key: s.key, filter: `stage:${s.key}`, label: s.label, color: s.color, n: counts[s.key] }))];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={format(new Date(), 'EEEE, d MMMM yyyy')} title="External Calibration" description="Track provider dispatch, return, calibration results, and certificate review." />

      <div className="panel p-5">
        <p className="eyebrow mb-3">Workflow · {counts.all} external equipment</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" role="group" aria-label="Filter by workflow stage">
          {tiles.map((t) => (
            <button key={t.key} type="button" onClick={() => setFilter(filter === t.filter ? 'all' : t.filter)} aria-pressed={filter === t.filter}
              className={`rounded-lg bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100 ${filter === t.filter ? 'ring-2 ring-slate-400' : ''}`} style={{ borderTop: `3px solid ${t.color}` }}>
              <p className="text-2xl font-semibold tabular-nums leading-tight">{t.n}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code, equipment, provider, or PO number..." className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="External calibration filters">
          {chips.map(([value, label, n]) => (
            <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter(value)}>
              {label} <span className="ml-1.5 opacity-70 tabular-nums">{n}</span>
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} items</span>
        </div>
      </div>

      {picked.size > 0 && (
        <div className="panel flex flex-wrap items-center gap-3 border-blue-200 bg-blue-50/60 px-4 py-2.5">
          <span className="text-sm font-medium">{picked.size} selected</span>
          {canManage && <Button size="sm" className="gap-2" disabled={!canPlan} title={canPlan ? 'Create one external calibration cycle for each selected equipment' : 'Every selected equipment already has a cycle in progress'} onClick={() => setPlanRows(pickedRows)}><ClipboardCheck className="h-4 w-4" />Plan batch</Button>}
          {canSend && <Button size="sm" variant="outline" className="gap-2" onClick={() => setSendRows(pickedRows)}><ArrowUpRight className="h-4 w-4" />Mark as sent to provider</Button>}
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setPrintRows(pickedRows)}><Printer className="h-4 w-4" />Print Check Record</Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel">
          {filter === 'action' && !query
            ? <EmptyState icon={SearchX} title="Nothing needs action" description="No external calibration equipment is expired, near expiration, or due for verification. Choose All External to see everything." />
            : <EmptyState icon={SearchX} title="No external calibration equipment found" description="Check the masterlist Checking type or adjust the filters." />}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className={`hidden md:grid ${GRID} gap-4 border-b bg-slate-50/70 px-5 py-2.5`}>
            <span className="flex items-center gap-2.5"><input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} aria-label="Select all shown equipment" className="h-4 w-4 rounded border-slate-300" /><span className="eyebrow">Equipment</span></span>
            {['Checking Due', 'Workflow', ''].map((heading, i) => <span key={i} className="eyebrow">{heading}</span>)}
          </div>
          {rows.map((row) => {
            const stage = displayStatus(row.cycle);
            const meta = STATUS_META[row.status];
            return (
              <div key={row.id} className={`grid ${GRID} items-center gap-3 md:gap-4 border-b last:border-0 px-5 py-3.5 hover:bg-blue-50/30`}>
                <div className="flex min-w-0 items-start gap-2.5">
                  <input type="checkbox" checked={picked.has(row.id)} onChange={() => togglePick(row.id)} aria-label={`Select ${row.equipment_code}`} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300" />
                  <div className="min-w-0">
                    <Link to={`/equipment/${row.id}`} className="font-medium text-primary hover:underline">{row.equipment_name}</Link>
                    <p className="font-mono text-xs text-muted-foreground">{row.equipment_code} · {row.serial_number || 'No serial'}</p>
                    <p className="text-xs text-muted-foreground">{row.cycle?.provider ? `${row.cycle.provider}${row.cycle.po_number ? ` · PO ${row.cycle.po_number}` : ''}${row.cycle.status === 'planned' && row.cycle.target_send_date ? ` · send ${fmtDate(row.cycle.target_send_date, 'dd MMM')}` : ''}` : 'Provider not assigned'}</p>
                  </div>
                </div>
                <div>
                  <p className="font-mono text-xs">{fmtDate(row.next_due)}</p>
                  {row.days_left !== null && <p className="mt-0.5 text-xs text-muted-foreground">{row.days_left < 0 ? `${Math.abs(row.days_left)} days overdue` : row.days_left === 0 ? 'Due today' : `${row.days_left} days left`}</p>}
                  {meta && <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium"><span className="h-[7px] w-[7px] rounded-full" style={{ background: meta.hex }} />{meta.label}</p>}
                </div>
                <div>
                  <Stepper cycle={row.cycle} />
                  {row.cycle?.certificate_review_status === 'rejected' && <p className="mt-1 text-xs text-red-600">Certificate needs follow-up</p>}
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Print check record" aria-label={`Print check record for ${row.equipment_code}`} onClick={() => setPrintRows([row])}><Printer className="h-4 w-4" /></Button>
                  {row.cycle?.status === 'completed' ? (
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => openWorkflow(row, canManage)}><ClipboardCheck className="h-4 w-4" />{canManage ? 'New Cycle' : 'View'}<ArrowUpRight className="h-3.5 w-3.5" /></Button>
                  ) : row.cycle ? (
                    <Button size="sm" variant={stage === 'certificate_review' ? 'default' : 'outline'} className={`gap-2 ${stage === 'certificate_review' ? 'bg-violet-600 text-white hover:bg-violet-700' : ''}`} onClick={() => openWorkflow(row)}><ClipboardCheck className="h-4 w-4" />{stage === 'certificate_review' ? 'Review Certificate' : 'Continue'}<ArrowUpRight className="h-3.5 w-3.5" /></Button>
                  ) : canManage ? (
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => openWorkflow(row, true)}><ClipboardCheck className="h-4 w-4" />Start<ArrowUpRight className="h-3.5 w-3.5" /></Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Needs action = expired, near expiration, for verify, or a cycle still in progress · sorted by checking due. Tick equipment (or use the printer icon) to print the Check Record that the provider signs on pick-up.</p>
      {selected && <ExternalCalibrationWorkflowDialog key={`${selected.id}-${selected.cycle?.id || 'new'}`} open={workflowOpen} equipment={equipment.find((item) => item.id === selected.id) || selected} cycle={selected.cycle} onClose={closeWorkflow} />}
      {printRows && <CheckRecordDialog rows={printRows} providers={providers} defaultDate={printDate} onClose={() => { setPrintRows(null); setPrintDate(null); }} />}
      {planRows && <PlanBatchDialog rows={planRows} providers={providers} me={me} refresh={refreshCycles} onClose={() => setPlanRows(null)} onDone={finishBatch} />}
      {sendRows && <SendBatchDialog rows={sendRows} me={me} refresh={refreshCycles} onClose={() => setSendRows(null)} onDone={finishBatch} />}
    </div>
  );
}