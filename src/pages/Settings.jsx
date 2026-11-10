import React, { useEffect, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/api/apiClient';
import { useSettings, useMe, useInvalidate } from '@/hooks/useCalData';
import { RESULTS, RESULT_META, STATUS_META } from '@/lib/calibration';
import { logAudit } from '@/lib/audit';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';

const KEYS = ['org_name', 'org_logo_url', 'document_title', 'near_days', 'due_soon_days', ...RESULTS.map((r) => `result_${r}_desc`)];

export default function Settings() {
  const { settings, data: record, isLoading } = useSettings();
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!isLoading && !form) setForm(Object.fromEntries(KEYS.map((k) => [k, settings[k]]))); }, [isLoading]);
  if (!form) return <LoadingState />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const upload = async (file) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) return setError('Logo must be PNG, JPG, SVG or WEBP');
    if (file.size > 512 * 1024) return setError('Logo must be 512 KB or smaller');
    setError('');
    setUploading(true);
    try {
      const { file_url } = await apiClient.integrations.Core.UploadPublicFile({ file });
      setForm((f) => ({ ...f, org_logo_url: file_url }));
    } catch (uploadError) {
      setError(uploadError.message || 'Could not upload the logo');
      toast.error(uploadError.message || 'Could not upload the logo');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const near = Number(form.near_days), soon = Number(form.due_soon_days);
    if (!form.org_name?.trim()) return setError('Organization name is required');
    if (!(soon >= 1 && near > soon && near <= 365)) return setError('Thresholds must satisfy 1 ≤ Due Soon < Near Expiration ≤ 365');
    setError('');
    setSaving(true);
    try {
    const data = { ...form, near_days: near, due_soon_days: soon };
    if (record?.id) await apiClient.entities.AppSettings.update(record.id, data);
    else await apiClient.entities.AppSettings.create(data);
    const changes = KEYS.filter((k) => String(settings[k] ?? '') !== String(data[k] ?? '')).map((k) => ({ field: k, from: String(settings[k] ?? ''), to: String(data[k] ?? '') }));
    await logAudit(me, { action: 'settings_update', entity_type: 'Settings', entity_label: 'System settings', changes });
    invalidate('settings');
    toast.success('Settings saved');
    } catch (saveError) {
      setError(saveError.message || 'Could not save settings');
      toast.error(saveError.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Administration" title="Settings" description="Organization identity, status thresholds and result definitions." />
      <div className="space-y-6 fade-up">
        <section className="panel p-6 space-y-4">
          <p className="eyebrow">Organization</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs">Organization Name</Label><Input value={form.org_name} onChange={set('org_name')} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Report Document Title</Label><Input value={form.document_title} onChange={set('document_title')} /></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg border bg-slate-50 flex items-center justify-center overflow-hidden">{form.org_logo_url ? <img src={form.org_logo_url} alt="logo" className="h-full w-full object-contain" /> : <span className="text-[10px] text-muted-foreground">No logo</span>}</div>
            <label className={`inline-flex items-center gap-2 text-sm rounded-md border px-3 py-2 hover:bg-slate-50 ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload logo<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} /></label>
            {form.org_logo_url && <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, org_logo_url: '' })}>Remove</Button>}
          </div>
        </section>
        <section className="panel p-6 space-y-4">
          <p className="eyebrow">Status & Notification Thresholds (days before due date)</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${STATUS_META.near.dot}`} />Near Expiration (≤ days)</Label><Input type="number" value={form.near_days} onChange={set('near_days')} /></div>
            <div className="space-y-1.5"><Label className="text-xs flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${STATUS_META.due_soon.dot}`} />Due Soon (≤ days)</Label><Input type="number" value={form.due_soon_days} onChange={set('due_soon_days')} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Equipment beyond the Near Expiration threshold is In Date; past the due date it is Expired. Statuses recalculate automatically every day.</p>
        </section>
        <section className="panel p-6 space-y-4">
          <p className="eyebrow">Result Definitions</p>
          {RESULTS.map((r) => (
            <div key={r} className="space-y-1.5"><Label className={`text-xs font-mono font-semibold ${RESULT_META[r].text}`}>{RESULT_META[r].label}</Label><Textarea rows={2} value={form[`result_${r}_desc`]} onChange={set(`result_${r}_desc`)} /></div>
          ))}
        </section>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
        <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Settings</Button></div>
      </div>
    </div>
  );
}