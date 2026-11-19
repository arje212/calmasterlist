import React, { useEffect, useRef, useState } from 'react';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { ImagePlus, Trash2, Circle, ArrowUpRight, Loader2, Info, Undo2, Check, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listAttachments, uploadAttachment, saveAttachment, deleteAttachment, loadImageUrl } from '@/api/reportFiles';

/* ============================================================================
   Photos / screenshots of a report.
   - "body"  slot (Tension Meter, Thermometer, Thickness Gauge, Air Particle Counter): the photos ARE the test data and are
             placed inside the blank test area of the report.
   - "sheet" slot (every other template): supporting photos on an extra ATTACHMENTS page; the Physical Condition line
             then says "(see attached photos)".
   Red circles / arrows are stored as fractions (0..1) of the image, exactly what fill_report.py burns into the picture.
   ============================================================================ */
const MAX_FILES = 12;
const RED = '#dc0000';

async function prepareImage(file) {
  if (!/^image\/(jpeg|png)$/.test(file.type)) throw new Error(`${file.name}: only JPEG or PNG images are allowed`);
  if (file.size <= 1_500_000) return file;                                   // small enough: upload as it is
  const bitmap = await createImageBitmap(file);                              // big phone photo: shrink before uploading
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image'))), 'image/jpeg', 0.88));
}

/** circles and arrows drawn over the picture (same geometry as burn() in fill_report.py) */
function Marks({ marks, size, draft }) {
  const [w, h] = size;
  const sw = Math.max(3, w / 200);
  const shapes = draft ? [...marks, draft] : marks;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {shapes.map((m, i) => {
        if (m.type === 'circle') {
          return <ellipse key={i} cx={m.x * w} cy={m.y * h} rx={(m.rx ?? m.r ?? 0.08) * w} ry={(m.ry ?? m.r ?? 0.08) * h} fill="none" stroke={RED} strokeWidth={sw} />;
        }
        const [x1, y1, x2, y2] = [m.x1 * w, m.y1 * h, m.x2 * w, m.y2 * h];
        const ang = Math.atan2(y2 - y1, x2 - x1), L = sw * 5;
        return (
          <g key={i} stroke={RED} strokeWidth={sw} strokeLinecap="round" fill="none">
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            {[-0.5, 0.5].map((s) => <line key={s} x1={x2} y1={y2} x2={x2 - L * Math.cos(ang + s)} y2={y2 - L * Math.sin(ang + s)} />)}
          </g>
        );
      })}
    </svg>
  );
}

function Photo({ src, marks, editing, tool, onCommit, onSize }) {
  const [size, setSize] = useState([1, 1]);
  const [draft, setDraft] = useState(null);
  const point = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const shape = (a, b) => (tool === 'circle'
    ? { type: 'circle', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, rx: Math.abs(b.x - a.x) / 2, ry: Math.abs(b.y - a.y) / 2 }
    : { type: 'arrow', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  const start = useRef(null);
  return (
    <div className="relative overflow-hidden rounded-md border bg-slate-100 select-none">
      <img
        src={src} alt="" draggable={false} className="block h-auto w-full"
        onLoad={(e) => { const s = [e.currentTarget.naturalWidth || 1, e.currentTarget.naturalHeight || 1]; setSize(s); onSize?.(s); }}
      />
      <Marks marks={marks} size={size} draft={draft} />
      {editing && (
        <div
          className="absolute inset-0 cursor-crosshair touch-none"
          onPointerDown={(e) => { start.current = point(e); setDraft(shape(start.current, start.current)); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (start.current) setDraft(shape(start.current, point(e))); }}
          onPointerUp={(e) => {
            if (!start.current) return;
            const d = shape(start.current, point(e));
            start.current = null; setDraft(null);
            const big = d.type === 'circle' ? d.rx > 0.01 || d.ry > 0.01 : Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 0.02;
            if (big) onCommit(d);
          }}
        />
      )}
    </div>
  );
}

export default function ReportAttachments({ reportId, slot = 'sheet', disabled = false, primary = false }) {
  const { confirm, confirmDialog } = useConfirm();
  const [items, setItems] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);            // { id, marks: [...], tool }
  const fileInput = useRef(null);
  const urlsRef = useRef({});
  urlsRef.current = urls;

  useEffect(() => {
    if (!reportId) return undefined;
    let live = true;
    setLoading(true);
    listAttachments(reportId).then((list) => { if (live) setItems(list); }).catch((e) => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [reportId]);

  useEffect(() => {                                  // fetch every picture once (blob: URLs, so it works with header auth too)
    let live = true;
    items.filter((a) => !urlsRef.current[a.id]).forEach((a) => {
      loadImageUrl(reportId, a.id).then((u) => { if (live) setUrls((cur) => ({ ...cur, [a.id]: u })); else URL.revokeObjectURL(u); }).catch(() => {});
    });
    return () => { live = false; };
  }, [items, reportId]);

  useEffect(() => () => { Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u)); }, []);

  const locked = disabled || !reportId;
  const patchItem = (id, patch) => setItems((cur) => cur.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError(''); setBusy(true);
    try {
      let count = items.length;
      for (const file of files) {
        if (count >= MAX_FILES) { setError(`Maximum ${MAX_FILES} photos per report`); break; }
        const blob = await prepareImage(file);
        const item = await uploadAttachment(reportId, blob, { caption: file.name.replace(/\.[^.]+$/, '') });
        setItems((cur) => [...cur, item]); count += 1;
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const saveCaption = async (a, caption) => {
    try { await saveAttachment(reportId, a.id, { caption, annotations: a.annotations || [] }); } catch (e) { setError(e.message); }
  };
  const remove = async (a) => {
    if (!(await confirm({ title: 'Remove this photo?', description: 'The photo and its markings will be removed from the report.', confirmLabel: 'Remove photo', destructive: true }))) return;
    setError('');
    try {
      await deleteAttachment(reportId, a.id);
      setItems((cur) => cur.filter((x) => x.id !== a.id));
      if (edit?.id === a.id) setEdit(null);
    } catch (e) { setError(e.message); }
  };
  const saveMarks = async (a) => {
    setError('');
    try {
      const saved = await saveAttachment(reportId, a.id, { caption: a.caption || '', annotations: edit.marks });
      patchItem(a.id, { annotations: saved.annotations });
      setEdit(null);
    } catch (e) { setError(e.message); }
  };

  const title = primary ? 'Test Data — Photos / Screenshots' : 'Supporting Photos (optional)';
  const hint = slot === 'body'
    ? 'These photos are the test data of this report. They are placed inside the blank test area of the form (best with 1–4 photos).'
    : 'Photos are printed on an extra ATTACHMENTS page, and the Physical Condition line will say “(see attached photos)”.';

  return (
    <div className="rounded-lg border p-4 space-y-4">
      {confirmDialog}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="eyebrow">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {!locked && (
          <>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png" multiple hidden onChange={(e) => addFiles(e.target.files)} data-testid="photo-input" />
            <Button type="button" size="sm" variant={primary ? 'default' : 'outline'} className="gap-2" disabled={busy || items.length >= MAX_FILES} onClick={() => fileInput.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Add photos
            </Button>
          </>
        )}
      </div>

      {!reportId && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /><span>Save the report as a draft first, then open it again to add photos.</span>
        </div>
      )}
      {reportId && disabled && items.length === 0 && !loading && <p className="text-xs text-muted-foreground">No photos attached.</p>}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      {loading && <p className="text-xs text-muted-foreground">Loading photos…</p>}

      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((a, index) => {
            const editing = edit?.id === a.id;
            const marks = editing ? edit.marks : a.annotations || [];
            return (
              <div key={a.id} className="space-y-2 rounded-md border p-2" data-testid="photo-card">
                {urls[a.id]
                  ? <Photo src={urls[a.id]} marks={marks} editing={editing} tool={edit?.tool} onCommit={(m) => setEdit((cur) => ({ ...cur, marks: [...cur.marks, m].slice(0, 20) }))} />
                  : <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-slate-100 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>}

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                  <Input
                    value={a.caption || ''} placeholder="Caption" disabled={locked} className="h-8 text-xs"
                    onChange={(e) => patchItem(a.id, { caption: e.target.value })} onBlur={(e) => { if (!locked) saveCaption(a, e.target.value); }}
                  />
                </div>

                {!locked && !editing && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setEdit({ id: a.id, marks: [...(a.annotations || [])], tool: 'circle' })}><Pencil className="h-3.5 w-3.5" />Mark</Button>
                    <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 gap-1 text-xs text-red-600 hover:text-red-700" onClick={() => remove(a)}><Trash2 className="h-3.5 w-3.5" />Remove</Button>
                  </div>
                )}

                {!locked && editing && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Drag on the photo to draw. Marks print in red.</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant={edit.tool === 'circle' ? 'default' : 'outline'} className="h-7 gap-1 text-xs" onClick={() => setEdit((c) => ({ ...c, tool: 'circle' }))}><Circle className="h-3.5 w-3.5" />Circle</Button>
                      <Button type="button" size="sm" variant={edit.tool === 'arrow' ? 'default' : 'outline'} className="h-7 gap-1 text-xs" onClick={() => setEdit((c) => ({ ...c, tool: 'arrow' }))}><ArrowUpRight className="h-3.5 w-3.5" />Arrow</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={!edit.marks.length} onClick={() => setEdit((c) => ({ ...c, marks: c.marks.slice(0, -1) }))}><Undo2 className="h-3.5 w-3.5" />Undo</Button>
                      <Button type="button" size="sm" className="ml-auto h-7 gap-1 text-xs" onClick={() => saveMarks(a)}><Check className="h-3.5 w-3.5" />Save marks</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEdit(null)}><X className="h-3.5 w-3.5" />Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
