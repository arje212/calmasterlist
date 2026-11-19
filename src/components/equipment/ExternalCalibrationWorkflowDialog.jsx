import React, { useEffect, useState } from 'react';
import { Download, FileCheck2, Loader2, PackageCheck, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useMe, useInvalidate } from '@/hooks/useCalData';
import { apiClient } from '@/api/apiClient';
import { logAudit } from '@/lib/audit';
import { RESULT_META, RESULTS, fmtDate } from '@/lib/calibration';

const CONDITIONS = [
  ['No physical damage observed', 'No Physical Damage observed'],
  ['With physical damage observed', 'With Physical Damage observed'],
];
const FUNCTIONS = [
  ['No functional issue', 'No Functional damage / issue'],
  ['With functional issue', 'With Functional damage / issues'],
];
const STEPS = ['planned', 'sent', 'returned', 'certificate review', 'completed'];

function TextField({ label, value, onChange, type = 'text', required = false, disabled = false }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required ? ' *' : ''}</Label>
      <Input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} />
    </div>
  );
}

function ChoiceField({ label, value, onChange, options, disabled = false }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select value={value || ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60">
        <option value="">Select condition</option>
        {options.map(([optionLabel, optionValue]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </div>
  );
}

export default function ExternalCalibrationWorkflowDialog({ open, equipment, cycle, onClose, onSaved }) {
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const [record, setRecord] = useState(cycle || null);
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const canReview = ['admin', 'qa_manager'].includes(me?.role);
  const canOperate = ['admin', 'user', 'sr_staff'].includes(me?.role);

  useEffect(() => {
    if (!open) return;
    setRecord(cycle || null);
    setForm({
      provider: cycle?.provider || '', target_send_date: cycle?.target_send_date || '', pr_number: cycle?.pr_number || '', po_number: cycle?.po_number || '',
      sent_date: cycle?.sent_date || '', initial_physical_condition: cycle?.initial_physical_condition || '', initial_functional_condition: cycle?.initial_functional_condition || '',
      issued_by: cycle?.issued_by || '', approved_by: cycle?.approved_by || '', provider_received_by: cycle?.provider_received_by || '', returned_date: cycle?.returned_date || '',
      returned_physical_condition: cycle?.returned_physical_condition || '', returned_functional_condition: cycle?.returned_functional_condition || '',
      returned_by_provider: cycle?.returned_by_provider || '', received_by: cycle?.received_by || '', return_approved_by: cycle?.return_approved_by || '',
      calibration_date: cycle?.calibration_date || '', calibration_result: cycle?.calibration_result || '', certificate_number: cycle?.certificate_number || '', remarks: cycle?.remarks || '',
    });
    setFile(null);
    setError('');
  }, [open, cycle?.id]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const audit = async (action, current, details = '') => {
    try {
      await logAudit(me, { action, entity_type: 'ExternalCalibration', entity_id: current.id, equipment_id: equipment.id, entity_label: equipment.equipment_code, details });
    } catch (auditError) {
      console.error('External calibration audit log failed:', auditError);
    }
  };
  const refresh = () => {
    invalidate('equipment', 'external-calibrations');
    onSaved?.();
  };
  const saveUpdate = async (values, details) => {
    const updated = await apiClient.externalCalibrations.update(record.id, values);
    setRecord(updated);
    await audit('update', updated, details);
    refresh();
    return updated;
  };
  const runAction = async (action) => {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (saveError) {
      setError(saveError.message || 'Could not save external calibration.');
      toast.error(saveError.message || 'Could not save external calibration.');
    } finally {
      setSaving(false);
    }
  };
  const startCycle = () => runAction(async () => {
    if (!form.provider.trim()) throw new Error('External provider is required.');
    const created = await apiClient.externalCalibrations.create({
      equipment_id: equipment.id, provider: form.provider.trim(), target_send_date: form.target_send_date,
      pr_number: form.pr_number.trim(), po_number: form.po_number.trim(),
    });
    setRecord(created);
    await audit('create', created, `External calibration planned with ${created.provider}`);
    toast.success('External calibration started');
    refresh();
  });
  const savePlan = () => runAction(() => saveUpdate({ provider: form.provider.trim(), target_send_date: form.target_send_date, pr_number: form.pr_number.trim(), po_number: form.po_number.trim() }, 'Updated provider and procurement references'));
  const markSent = () => runAction(() => {
    if (!form.sent_date || !form.initial_physical_condition || !form.initial_functional_condition || !form.issued_by.trim() || !form.approved_by.trim() || !form.provider_received_by.trim()) throw new Error('Complete the dispatch date, initial conditions, and all dispatch sign-offs.');
    return saveUpdate({ ...form, status: 'sent' }, 'Equipment sent to external provider');
  });
  const markReturned = () => runAction(() => {
    if (!form.returned_date || !form.returned_physical_condition || !form.returned_functional_condition || !form.returned_by_provider.trim() || !form.received_by.trim() || !form.return_approved_by.trim()) throw new Error('Complete the return date, received conditions, and all return sign-offs.');
    return saveUpdate({ ...form, status: 'returned' }, 'Equipment returned from external provider');
  });
  const saveResult = () => runAction(() => {
    if (!form.calibration_date || !form.calibration_result || !form.certificate_number.trim()) throw new Error('Calibration date, result, and certificate number are required.');
    return saveUpdate({ calibration_date: form.calibration_date, calibration_result: form.calibration_result, certificate_number: form.certificate_number.trim(), remarks: form.remarks }, 'Saved external calibration result and certificate details');
  });
  const uploadCertificate = () => runAction(async () => {
    if (!file) throw new Error('Choose a PDF, JPG, or PNG certificate first.');
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error('Certificate must be PDF, JPG, or PNG.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Certificate must be 10 MB or smaller.');
    const certificate_file = await apiClient.externalCalibrations.uploadCertificate(record.id, file);
    setRecord((current) => ({ ...current, certificate_file }));
    setFile(null);
    await audit('update', record, `Uploaded certificate ${certificate_file.original_name}`);
    refresh();
    toast.success('Certificate uploaded');
  });
  const reviewCertificate = (decision) => runAction(async () => {
    if (!form.calibration_date || !form.calibration_result || !form.certificate_number.trim()) throw new Error('Calibration date, result, and certificate number are required before review.');
    if (canOperate) {
      await saveUpdate({ calibration_date: form.calibration_date, calibration_result: form.calibration_result, certificate_number: form.certificate_number.trim(), remarks: form.remarks }, 'Saved calibration details before certificate review');
    }
    const reviewed = await apiClient.externalCalibrations.review(record.id, decision, form.remarks);
    setRecord(reviewed);
    await audit('update', reviewed, `Certificate ${decision} by ${me?.full_name || me?.email}`);
    refresh();
    toast.success(decision === 'accepted' ? 'Certificate accepted; masterlist due date updated' : 'Certificate rejected for follow-up');
  });
  const downloadCertificate = () => runAction(async () => {
    const blob = await apiClient.externalCalibrations.certificate(record.id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = record.certificate_file?.original_name || 'calibration-certificate';
    anchor.click();
    URL.revokeObjectURL(url);
  });

  const completed = record?.status === 'completed';
  const readyForReview = record?.status === 'returned' && record.certificate_file && record.calibration_date && record.calibration_result && record.certificate_number;
  const currentStep = completed ? 4 : readyForReview ? 3 : Math.max(0, STEPS.indexOf(record?.status || 'planned'));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>External Calibration</DialogTitle>
          <DialogDescription>{equipment.equipment_code} · {equipment.equipment_name} · Current due {fmtDate(equipment.next_due)}</DialogDescription>
        </DialogHeader>
        {record && <div className="grid grid-cols-4 gap-2" aria-label="External calibration progress">
          {STEPS.map((step, index) => <div key={step} className={`border-t-2 pt-2 text-xs font-semibold uppercase ${index <= currentStep ? 'border-emerald-500 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>{step}</div>)}
        </div>}

        {!record ? (
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="External Provider" value={form.provider} onChange={(value) => set('provider', value)} required />
              <TextField label="Target Send Date" type="date" value={form.target_send_date} onChange={(value) => set('target_send_date', value)} />
              <TextField label="PR Number" value={form.pr_number} onChange={(value) => set('pr_number', value)} />
              <TextField label="PO Number" value={form.po_number} onChange={(value) => set('po_number', value)} />
            </div>
            <p className="text-xs text-muted-foreground">This external calibration cycle is separate from internal verification reports.</p>
            <DialogFooter>{canOperate && <Button onClick={startCycle} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Start External Calibration</Button>}</DialogFooter>
          </section>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2">
              <TextField label="External Provider" value={form.provider} onChange={(value) => set('provider', value)} disabled={completed || !canOperate} required />
              <TextField label="Target Send Date" type="date" value={form.target_send_date} onChange={(value) => set('target_send_date', value)} disabled={completed || !canOperate} />
              <TextField label="PR Number" value={form.pr_number} onChange={(value) => set('pr_number', value)} disabled={completed || !canOperate} />
              <TextField label="PO Number" value={form.po_number} onChange={(value) => set('po_number', value)} disabled={completed || !canOperate} />
            </section>
            {!completed && canOperate && <div className="flex justify-end"><Button variant="outline" onClick={savePlan} disabled={saving}>Save Plan</Button></div>}

            {(record.status === 'planned' || record.status === 'sent') && <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Dispatch</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Date Sent" type="date" value={form.sent_date} onChange={(value) => set('sent_date', value)} disabled={completed || record.status !== 'planned' || !canOperate} />
                <TextField label="Issued By" value={form.issued_by} onChange={(value) => set('issued_by', value)} disabled={completed || record.status !== 'planned' || !canOperate} />
                <ChoiceField label="Initial Physical Condition" value={form.initial_physical_condition} onChange={(value) => set('initial_physical_condition', value)} options={CONDITIONS} disabled={completed || record.status !== 'planned' || !canOperate} />
                <ChoiceField label="Initial Functional Condition" value={form.initial_functional_condition} onChange={(value) => set('initial_functional_condition', value)} options={FUNCTIONS} disabled={completed || record.status !== 'planned' || !canOperate} />
                <TextField label="Approved By" value={form.approved_by} onChange={(value) => set('approved_by', value)} disabled={completed || record.status !== 'planned' || !canOperate} />
                <TextField label="Received By (Provider Representative)" value={form.provider_received_by} onChange={(value) => set('provider_received_by', value)} disabled={completed || record.status !== 'planned' || !canOperate} />
              </div>
              {record.status === 'planned' && canOperate && <div className="flex justify-end"><Button onClick={markSent} disabled={saving}><Send className="mr-2 h-4 w-4" />Mark Sent</Button></div>}
            </section>}

            {(record.status === 'sent' || record.status === 'returned') && <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Return from Provider</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Date Returned" type="date" value={form.returned_date} onChange={(value) => set('returned_date', value)} disabled={completed || record.status !== 'sent' || !canOperate} />
                <ChoiceField label="Returned Physical Condition" value={form.returned_physical_condition} onChange={(value) => set('returned_physical_condition', value)} options={CONDITIONS} disabled={completed || record.status !== 'sent' || !canOperate} />
                <ChoiceField label="Returned Functional Condition" value={form.returned_functional_condition} onChange={(value) => set('returned_functional_condition', value)} options={FUNCTIONS} disabled={completed || record.status !== 'sent' || !canOperate} />
                <TextField label="Issued By (Provider Representative)" value={form.returned_by_provider} onChange={(value) => set('returned_by_provider', value)} disabled={completed || record.status !== 'sent' || !canOperate} />
                <TextField label="Received By" value={form.received_by} onChange={(value) => set('received_by', value)} disabled={completed || record.status !== 'sent' || !canOperate} />
                <TextField label="Return Approved By" value={form.return_approved_by} onChange={(value) => set('return_approved_by', value)} disabled={completed || record.status !== 'sent' || !canOperate} />
              </div>
              {record.status === 'sent' && canOperate && <div className="flex justify-end"><Button onClick={markReturned} disabled={saving}><PackageCheck className="mr-2 h-4 w-4" />Mark Returned</Button></div>}
            </section>}

            {(record.status === 'returned' || completed) && <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Calibration Result and Certificate</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Calibration Date" type="date" value={form.calibration_date} onChange={(value) => set('calibration_date', value)} disabled={completed || !canOperate} />
                <ChoiceField label="Result" value={form.calibration_result} onChange={(value) => set('calibration_result', value)} options={RESULTS.map((result) => [RESULT_META[result].label, result])} disabled={completed || !canOperate} />
                <TextField label="Certificate Number" value={form.certificate_number} onChange={(value) => set('certificate_number', value)} disabled={completed || !canOperate} />
                <TextField label="Provider Remarks" value={form.remarks} onChange={(value) => set('remarks', value)} disabled={completed || !canOperate} />
              </div>
              {record.status === 'returned' && (canOperate || canReview) && <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5"><Label className="text-xs">Calibration Certificate (PDF, JPG, PNG · max 10 MB)</Label><Input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} disabled={saving || (!canOperate && !canReview)} /></div>
                <div className="flex flex-wrap gap-2">
                  {canOperate && <Button variant="outline" onClick={saveResult} disabled={saving}>Save Result</Button>}
                  <Button variant="outline" onClick={uploadCertificate} disabled={saving || !file}><Upload className="mr-2 h-4 w-4" />Upload Certificate</Button>
                </div>
              </div>}
              {record.certificate_file && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm"><span className="truncate">{record.certificate_file.original_name}</span><Button variant="ghost" size="sm" onClick={downloadCertificate} disabled={saving}><Download className="mr-2 h-4 w-4" />Download</Button></div>}
              {record.status === 'returned' && canReview && <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                {record.certificate_review_status === 'rejected' && <p className="mr-auto self-center text-xs text-red-700">Certificate rejected: {record.review_remarks}</p>}
                <Button variant="outline" onClick={() => reviewCertificate('rejected')} disabled={saving || !record.certificate_file || !form.calibration_date || !form.calibration_result || !form.certificate_number.trim()}>Reject Certificate</Button>
                <Button onClick={() => reviewCertificate('accepted')} disabled={saving || !record.certificate_file || !form.calibration_date || !form.calibration_result || !form.certificate_number.trim()}><FileCheck2 className="mr-2 h-4 w-4" />Accept and Update Due Date</Button>
              </div>}
              {completed && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Certificate accepted by {record.reviewed_by_name || 'QA'} on {fmtDate(record.reviewed_at)}. Masterlist due date: {fmtDate(equipment.next_due)}.</p>}
            </section>}
          </div>
        )}
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
