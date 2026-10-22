import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';
import { useMe, useInvalidate, useSettings } from '@/hooks/useCalData';
import { calcNextDue, today, RESULT_META, fmtDate } from '@/lib/calibration';
import { logAudit } from '@/lib/audit';
import VerifyFormFields from '@/components/equipment/VerifyFormFields';

export default function VerifyDialog({ open, onClose, equipment: e, onSaved }) {
  const { data: me } = useMe();
  const { settings } = useSettings();
  const invalidate = useInvalidate();
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { const d = today(); setForm({ verification_date: d, next_due_date: calcNextDue(d, e.frequency_months), result: '', verification_method: '', findings: '', remarks: '' }); setFile(null); setError(''); }
  }, [open]);

  const save = async () => {
    if (!form.verification_date || !form.next_due_date || !form.result) return setError('Verification date, next due date and result are required.');
    if (form.verification_date > today()) return setError('Verification date cannot be in the future.');
    if (form.next_due_date <= form.verification_date) return setError('Next due date must be after the verification date.');
    if (file && !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return setError('Attachments must be PDF, JPG or PNG.');
    if (file && file.size > 10 * 1024 * 1024) return setError('Attachment must be 10 MB or smaller.');
    setSaving(true);
    setError('');
    try {
    let attachment = {};
    if (file) {
      const { file_uri } = await apiClient.integrations.Core.UploadPrivateFile({ file });
      attachment = { attachment_uri: file_uri, attachment_name: file.name };
    }
    const data = Object.fromEntries(Object.entries({
      equipment_id: e.id, equipment_code: e.equipment_code, equipment_name: e.equipment_name,
      previous_verification_date: e.last_date, previous_due_date: e.next_due, ...form, ...attachment,
      verified_by_name: me?.full_name || me?.email, verified_by_email: me?.email,
    }).filter(([, v]) => v));
    const vr = await apiClient.entities.VerificationRecord.create(data);
    if (me?.role === 'admin') {
      await apiClient.entities.Equipment.update(e.id, { last_verification_date: form.verification_date, next_due_date: form.next_due_date, last_result: form.result, updated_by_name: me?.full_name || me?.email });
    }
    await logAudit(me, {
      action: 'verify', entity_type: 'VerificationRecord', entity_id: vr.id, equipment_id: e.id, entity_label: e.equipment_code,
      changes: [
        { field: 'Last Verification Date', from: e.last_date || '', to: form.verification_date },
        { field: 'Next Verification Date', from: e.next_due || '', to: form.next_due_date },
        { field: 'Result', from: RESULT_META[e.result]?.label || '', to: RESULT_META[form.result].label },
      ],
      details: form.findings || form.remarks || '',
    });
    invalidate('verifications', 'equipment');
    toast.success('Verification recorded');
    onSaved(vr);
    } catch (saveError) {
      setError(saveError.message || 'Could not save verification');
      toast.error(saveError.message || 'Could not save verification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record {e.calibration_type || 'Verification'}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{e.equipment_code} · {e.equipment_name} · Last verified {fmtDate(e.last_date)}</DialogDescription>
        </DialogHeader>
        <VerifyFormFields form={form} setForm={setForm} file={file} setFile={setFile} frequency={e.frequency_months} settings={settings} />
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Verification</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}