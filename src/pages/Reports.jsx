import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, AlertTriangle, ChevronRight, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCalibrationData, useMe } from '@/hooks/useCalData';
import { fmtDate } from '@/lib/calibration';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import ReportStatusBadge from '@/components/common/ReportStatusBadge';

/* ---------------------------------------------------------------------------------------------
   Folder view: one folder per equipment type (same as the report folders on the server),
   plus a pinned "Needs action" folder.  Click a folder -> its reports open in a window on the right.
   --------------------------------------------------------------------------------------------- */

// Which folder a report goes into, decided from the equipment name. First match wins; names that match nothing get a folder
// of their own (brackets, "#3" and trailing numbers removed), so a new equipment type never disappears.
// To merge or rename folders, just edit this list.
const FOLDER_RULES = [
  [/laser\s*micrometer/i, 'Laser Micrometer'],
  [/micrometer/i, 'Micrometer'],
  [/caliper|vernier/i, 'Caliper'],
  [/air\s*particle|particle\s*counter/i, 'Air Particle Counter'],
  [/\ba-?\s?test\b/i, 'A-Test Machine'],
  [/pocket\s*weigh/i, 'Pocket Weighing Scale'],
  [/balance|weighing/i, 'Balance'],
  [/digimatic/i, 'Digimatic Indicator'],
  [/dial\s*indicator/i, 'Dial Indicator'],
  [/flat\s*bar/i, 'Flat Bar'],
  [/pressure\s*gauge/i, 'Digital Pressure Gauge'],
  [/tachometer/i, 'Digital Tachometer'],
  [/multimeter/i, 'Handheld Multimeter'],
  [/multi\s*tester/i, 'MultiTester'],
  [/microscope/i, 'Measuring Microscope'],
  [/\bph\s*meter/i, 'pH Meter'],
  [/push\s*pull/i, 'Push Pull Gauge'],
  [/lupe/i, 'Scale Lupe'],
  [/steel\s*ruler/i, 'Steel Ruler'],
  [/plastic\s*ruler/i, 'Plastic Ruler'],
  [/temp\w*\s*probe/i, 'Temperature Probe'],
  [/temperature\s*tester/i, 'Temperature Tester'],
  [/tension\s*meter/i, 'Tension Meter'],
];
const folderOf = (name) => {
  const hit = FOLDER_RULES.find(([pattern]) => pattern.test(name || ''));
  if (hit) return hit[1];
  return String(name || '').replace(/\(.*?\)/g, '').replace(/#\s*\d+/g, '').replace(/\s+\d+$/, '').replace(/\s+/g, ' ').trim() || 'Other';
};

const ACTION = '__action';
// what each role has to do next -> the pinned "Needs action" / "To do" folder
const ACTION_STATUSES = { admin: ['submitted', 'reviewed'], sr_staff: ['submitted'], qa_manager: ['reviewed'], user: ['rejected', 'draft'] };

const text = (value) => String(value || '');
const numeric = (a, b) => text(a).localeCompare(text(b), undefined, { numeric: true });
const newestFirst = (a, b) => text(b.verification_date).localeCompare(text(a.verification_date)) || numeric(b.report_number, a.report_number);
const yearOf = (iso) => text(iso).slice(0, 4);
const monthLabel = (iso) => {
  const m = text(iso).match(/^(\d{4})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : 'No date';
};
const desk = { backgroundColor: '#eef2f7', backgroundImage: 'radial-gradient(#d3dbe8 1px, transparent 1px)', backgroundSize: '22px 22px' };

function FolderIcon({ blue = false, badge = 0 }) {
  const c = blue ? { back: '#2563eb', front: '#4f8bf5', badge: '#dc2626' } : { back: '#e0a92b', front: '#f6c453', badge: '#2563eb' };
  return (
    <span className="relative mt-3 block h-[62px] w-[84px]" aria-hidden="true">
      <span className="absolute -top-[9px] left-0 block h-3 w-[34px]" style={{ background: c.back, borderRadius: '5px 5px 0 0' }} />
      <span className="absolute inset-0 block" style={{ background: c.back, borderRadius: '4px 9px 9px 9px' }} />
      <span className="absolute inset-x-0 bottom-0 block h-12" style={{ background: c.front, borderRadius: '5px 8px 9px 9px' }} />
      {badge > 0 && <span className="absolute -right-2.5 -top-3.5 z-10 block min-w-[22px] rounded-full px-1.5 text-center text-xs font-semibold leading-[22px] text-white ring-2 ring-[#eef2f7]" style={{ background: c.badge }}>{badge}</span>}
    </span>
  );
}

function Folder({ label, caption, count, blue, selected, onOpen }) {
  return (
    <button type="button" onClick={onOpen} aria-pressed={selected}
      className={`flex flex-col items-center gap-1.5 rounded-xl px-1.5 pb-3 pt-3.5 text-center transition-colors ${selected ? 'bg-white ring-2 ring-blue-600' : 'hover:bg-white/70'}`}>
      <FolderIcon blue={blue} badge={count} />
      <span className="text-[13px] font-semibold leading-tight text-slate-900">{label}</span>
      <span className="text-[11px] text-slate-600">{caption}</span>
    </button>
  );
}

function ReportRow({ r, showType }) {
  const s = r.equipment_snapshot || {};
  return (
    <Link to={`/reports/${r.id}`} className="group flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 transition-colors hover:bg-blue-50/60">
      <div className="min-w-0">
        <p className="font-mono text-[13px] font-semibold text-slate-900 group-hover:text-primary">{r.report_number}</p>
        <p className="truncate text-xs text-slate-600">{showType ? `${folderOf(s.equipment_name)} · ` : ''}{s.equipment_name || '—'} · {s.equipment_code || '—'}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right"><ReportStatusBadge status={r.status} /><p className="mt-0.5 text-[11px] text-slate-600">{fmtDate(r.verification_date)}</p></div>
        <ChevronRight className="hidden h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 sm:block" />
      </div>
    </Link>
  );
}

export default function Reports() {
  const { reports, equipment, isLoading } = useCalibrationData();
  const { data: me } = useMe();
  const isAdmin = me?.role === 'admin';
  const isReviewer = isAdmin || ['sr_staff', 'qa_manager'].includes(me?.role);
  const [q, setQ] = useState('');
  const [year, setYear] = useState(null);       // null = latest year that has reports
  const [sel, setSel] = useState(null);         // null = automatic (Needs action if anything is waiting, else the first folder)
  const [closed, setClosed] = useState(false);
  const [view, setView] = useState('all');      // inside a folder: all | action
  const [limit, setLimit] = useState(8);

  const visible = useMemo(() => reports.filter((r) => isReviewer || r.created_by_id === me?.id), [reports, me, isReviewer]);
  const years = useMemo(() => [...new Set(visible.map((r) => yearOf(r.verification_date)).filter(Boolean))].sort().reverse(), [visible]);
  const activeYear = year ?? years[0] ?? 'all';
  const actionStatuses = ACTION_STATUSES[me?.role] || [];
  const needsAction = (r) => actionStatuses.includes(r.status);
  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  const scoped = useMemo(() => visible.filter((r) => (activeYear === 'all' || yearOf(r.verification_date) === activeYear)
    && (!query || [r.report_number, r.equipment_snapshot?.equipment_name, r.equipment_snapshot?.equipment_code, r.created_by_name].some((v) => text(v).toLowerCase().includes(query)))),
  [visible, activeYear, query]);

  const folders = useMemo(() => {
    const map = new Map();
    scoped.forEach((r) => {
      const label = folderOf(r.equipment_snapshot?.equipment_name);
      if (!map.has(label)) map.set(label, { key: label, label, reports: [] });
      map.get(label).reports.push(r);
    });
    return [...map.values()].map((f) => ({ ...f, action: f.reports.filter(needsAction).length })).sort((a, b) => numeric(a.label, b.label));
  }, [scoped, me]);
  const actionReports = useMemo(() => scoped.filter(needsAction), [scoped, me]);
  const actionLabel = isReviewer ? 'Needs action' : 'To do';

  const defaultSel = actionReports.length ? ACTION : folders[0]?.key ?? null;
  const selected = closed ? null : (sel === ACTION || folders.some((f) => f.key === sel)) ? sel : defaultSel;
  const current = selected === ACTION ? { label: actionLabel, reports: actionReports } : folders.find((f) => f.key === selected);
  const showWindow = searching || Boolean(current);

  let list = searching ? scoped : current?.reports || [];
  if (!searching && selected !== ACTION && view === 'action') list = list.filter(needsAction);
  list = [...list].sort(newestFirst);
  const shown = list.slice(0, limit);
  const monthTotals = list.reduce((acc, r) => { const m = monthLabel(r.verification_date); acc[m] = (acc[m] || 0) + 1; return acc; }, {});
  const awaiting = equipment.filter((e) => e.report_state === 'required').length;

  const openFolder = (key) => { setSel(key); setClosed(false); setView('all'); setLimit(8); };
  let lastMonth = null;

  return (
    <div>
      <PageHeader eyebrow="Documentation" title={isReviewer ? 'Verification Reports' : 'My Reports'} description={isReviewer ? 'Review, approve and manage verification reports for your role.' : 'Reports you have created.'} />

      {awaiting > 0 && (
        <Link to="/masterlist?report=required" className="mb-4 inline-flex items-center gap-2 text-xs text-red-700 hover:underline fade-up">
          <AlertTriangle className="h-3.5 w-3.5" /><span><strong>{awaiting}</strong> verified equipment still need a report</span><ChevronRight className="h-3 w-3" />
        </Link>
      )}

      <div className="mb-3 flex flex-col gap-3 fade-up lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Folder path" className="text-sm text-slate-600">
          Reports › {activeYear === 'all' ? 'All years' : activeYear}{!searching && current && <> › <strong className="text-slate-900">{current.label}</strong></>}
        </nav>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1 lg:w-64 lg:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setLimit(8); }} placeholder="Search report, equipment, name…" aria-label="Search reports" className="h-9 pl-9" />
          </div>
          <Select value={activeYear} onValueChange={(v) => { setYear(v); setLimit(8); }}>
            <SelectTrigger className="h-9 w-[120px] text-xs" aria-label="Year"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}<SelectItem value="all">All years</SelectItem></SelectContent>
          </Select>
          <button type="button" onClick={() => { setQ(''); openFolder(ACTION); }} className="h-9 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700">{actionLabel} · {actionReports.length}</button>
        </div>
      </div>

      {isLoading ? <LoadingState /> : visible.length === 0 ? <div className="panel"><EmptyState icon={FileText} title="No reports found" description="Reports will appear here as folders." /></div> : (
        <div className="rounded-2xl border border-slate-200 p-4 fade-up lg:p-6" style={desk}>
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="grid flex-1 content-start gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              <Folder blue label={actionLabel} count={actionReports.length} caption={actionReports.length ? `${actionReports.length} waiting for you` : 'Nothing waiting'} selected={!searching && selected === ACTION} onOpen={() => openFolder(ACTION)} />
              {folders.map((f) => (
                <Folder key={f.key} label={f.label} count={f.action} caption={`${f.reports.length} ${f.reports.length === 1 ? 'report' : 'reports'}`} selected={!searching && selected === f.key} onOpen={() => openFolder(f.key)} />
              ))}
            </div>

            {showWindow && (
              <section aria-label="Folder contents" className="w-full flex-none self-start overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200 lg:w-[470px]">
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold text-slate-900">{searching ? `Results for “${q.trim()}”` : current.label}</h2>
                    <p className="text-xs text-slate-600">{list.length} {list.length === 1 ? 'report' : 'reports'} · newest first</p>
                  </div>
                  <button type="button" aria-label="Close folder" onClick={() => { setQ(''); setClosed(true); }} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"><X className="h-4 w-4 text-slate-600" /></button>
                </div>
                {!searching && selected !== ACTION && (
                  <div className="flex gap-1 px-4 pb-3">
                    {[['all', 'All'], ['action', `${actionLabel} · ${current.reports.filter(needsAction).length}`]].map(([key, label]) => (
                      <button key={key} type="button" onClick={() => { setView(key); setLimit(8); }} aria-pressed={view === key}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${view === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>
                    ))}
                  </div>
                )}
                {list.length === 0 ? <p className="border-t border-slate-100 px-4 py-8 text-center text-sm text-slate-600">{searching ? 'No report matches your search.' : selected === ACTION ? 'You are all caught up. Nothing is waiting for you.' : 'Nothing here.'}</p> : (
                  <div>
                    {shown.map((r) => {
                      const m = monthLabel(r.verification_date);
                      const header = m !== lastMonth ? (
                        <div className="flex justify-between bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600"><span>{m}</span><span>{monthTotals[m]}</span></div>
                      ) : null;
                      lastMonth = m;
                      return <React.Fragment key={r.id}>{header}<ReportRow r={r} showType={searching || selected === ACTION} /></React.Fragment>;
                    })}
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                      <span>Showing {shown.length} of {list.length}</span>
                      {shown.length < list.length && <button type="button" onClick={() => setLimit((n) => n + 8)} className="font-semibold text-blue-700 hover:underline">Show more</button>}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-600">{folders.length} {folders.length === 1 ? 'folder' : 'folders'} · {scoped.length} {scoped.length === 1 ? 'report' : 'reports'}</p>
        </div>
      )}
    </div>
  );
}