import React, { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/api/apiClient';

function Thumb({ reportId, id }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let u; apiClient.reports.attachments.image(reportId, id).then((b) => { u = URL.createObjectURL(b); setSrc(u); }).catch(() => {}); return () => u && URL.revokeObjectURL(u); }, [reportId, id]);
  return src ? <img src={src} alt="" className="h-28 w-40 rounded border object-cover" /> : <div className="h-28 w-40 rounded border bg-slate-100" />;
}

// Photos for "Physical Condition" (broken jaw, damage, etc.).  Server: JPEG/PNG only, 12 MB, max 12 files, locked after submit.
// onChange() lets the page refresh the PDF preview after a photo/caption changes.
export default function AttachmentsPanel({ report, canEdit, onChange }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const load = () => apiClient.reports.attachments.list(report.id).then(setItems).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [report.id]);

  const upload = async (files) => {
    setBusy(true);
    try { for (const f of files) await apiClient.reports.attachments.upload(report.id, f, ''); await load(); onChange?.(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const saveCaption = (a, caption) => caption !== a.caption && apiClient.reports.attachments.update(report.id, a.id, { caption }).then(() => { load(); onChange?.(); }).catch((e) => toast.error(e.message));
  const remove = async (a) => { try { await apiClient.reports.attachments.remove(report.id, a.id); await load(); onChange?.(); } catch (e) { toast.error(e.message); } };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Attachments (photos)</p>
        {canEdit && <>
          <input ref={input} type="file" accept="image/jpeg,image/png" multiple hidden onChange={(e) => upload([...e.target.files])} />
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}Add photo</Button>
        </>}
      </div>
      {items === null ? null : items.length === 0 ? <p className="text-xs text-muted-foreground">No photos. Add one if the equipment has damage or a defect to show.</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((a) => (
            <div key={a.id} className="flex gap-3">
              <Thumb reportId={report.id} id={a.id} />
              <div className="flex-1 space-y-1.5">
                <Input defaultValue={a.caption} disabled={!canEdit} placeholder="Caption, e.g. Broken internal jaw" className="h-8 text-xs" onBlur={(e) => saveCaption(a, e.target.value)} />
                {canEdit && <button type="button" onClick={() => remove(a)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"><Trash2 className="h-3 w-3" />Remove</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}