import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';
import { useCalibrationData, useMe, useInvalidate } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import ReportFormFields, { createCaliperData, createScaleLupeData } from '@/components/reports/ReportFormFields';
import ReportContextCard from '@/components/reports/ReportContextCard';
import { reportTemplateForEquipment } from '@/lib/reportTemplates';

// Report name format: CAL-<control number>_<YY>-<NN>   e.g. CAL-DG0014ME_26-01
//  YY = year of the verification date (26 = 2026)
//  NN = running number of reports for THAT equipment in THAT year (01, 02, ...). Starts again at 01 every new year.
function reportNameFor(equipment, verificationDate, reports = [], ignoreId = null) {
  const code = String(equipment?.equipment_code || '').replace(/\s+/g, '');
  const year = /^\d{4}/.test(String(verificationDate || '')) ? String(verificationDate).slice(0, 4) : String(new Date().getFullYear());
  const prefix = `CAL-${code}_${year.slice(2)}-`;
  const mine = reports.filter((r) => r.id !== ignoreId && r.equipment_id === equipment?.id);
  // highest number already used in a name with this prefix (safe even if an older report was deleted)
  const maxUsed = Math.max(0, ...mine.map((r) => {
    const name = String(r.report_number || '');
    const n = name.startsWith(prefix) ? parseInt(name.slice(prefix.length), 10) : 0;
    return Number.isFinite(n) ? n : 0;
  }));
  // reports of this equipment verified in this year, whatever their name (covers older "VR-..." names)
  const sameYear = mine.filter((r) => String(r.verification_date || '').slice(0, 4) === year).length;
  return `${prefix}${String(Math.max(maxUsed, sameYear) + 1).padStart(2, '0')}`;
}

const SNAP_KEYS = ['equipment_name', 'equipment_code', 'serial_number', 'asset_number', 'manufacturer', 'model', 'location', 'department', 'description', 'range', 'accuracy', 'required_accuracy'];

function prepareReportData(reportData = {}, equipment = {}) {
  reportData = {
    ...reportData,
    range: reportData.range || equipment.range || equipment.description || '',
    equipment_accuracy: reportData.equipment_accuracy || equipment.accuracy || '',
    required_accuracy: reportData.required_accuracy || equipment.required_accuracy || '',
  };
  const isCaliper = reportData.template === 'caliper' || reportTemplateForEquipment(equipment) === 'caliper';
  if (!isCaliper) return { ...createScaleLupeData(), ...reportData, template: 'standard' };

  const defaults = createCaliperData();
  const savedSections = reportData.measurement_sections;
  const measurementSections = Array.isArray(savedSections) && savedSections.length
    ? savedSections
    : defaults.measurement_sections.map((section, index) => ({
        ...section,
        rows: index === 0 && reportData.x_points?.length
          ? reportData.x_points
          : index === 1 && reportData.y_points?.length
            ? reportData.y_points
            : section.rows,
      }));

  return {
    ...defaults,
    ...reportData,
    template: 'caliper',
    measurement_sections: measurementSections,
    parallelism: reportData.parallelism?.length ? reportData.parallelism : defaults.parallelism,
    standard_equipment: { ...defaults.standard_equipment, ...reportData.standard_equipment },
    stabilization: { ...defaults.stabilization, ...reportData.stabilization },
  };
}
 
export default function ReportEditor() {
  const { id } = useParams();
  const vrId = new URLSearchParams(window.location.search).get('verification');
  const { equipment, verifications, reports, standardEquipment, isLoading } = useCalibrationData();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const existing = id ? reports.find((r) => r.id === id) : null;
  const vr = verifications.find((v) => v.id === (existing?.verification_id || vrId));
  const eq = equipment.find((e) => e.id === (existing?.equipment_id || vr?.equipment_id));
  const duplicate = !id && vr ? reports.find((r) => r.verification_id === vr.id) : null;
  const isAdmin = me?.role === 'admin';
  const canCreate = isAdmin || me?.role === 'user';

  useEffect(() => {
    if (isLoading || form) return;
    const snapshot = Object.fromEntries(SNAP_KEYS.map((key) => [key, existing?.equipment_snapshot?.[key] || eq?.[key] || (key === 'range' ? eq?.description : '') || vr?.[key] || '']));
    if (existing) setForm({ ...existing, report_data: prepareReportData(existing.report_data, { ...eq, ...snapshot }) });
    else if (vr) {
      const createData = reportTemplateForEquipment(eq) === 'caliper' ? createCaliperData : createScaleLupeData;
      // Report name, e.g. CAL-DG0014ME_26-01 (control number, year of verification, running number for that year)
      const reportName = reportNameFor({ id: vr.equipment_id, equipment_code: snapshot.equipment_code }, vr.verification_date, reports);
      setForm({ report_number: reportName, verification_method: vr.verification_method || '', findings: vr.findings || '', remarks: '', report_data: createData({ range: eq?.description || '', equipment_accuracy: eq?.accuracy || '', required_accuracy: eq?.required_accuracy || '' }) });
    }
  }, [isLoading, existing, vr, eq, reports]);

  if (isLoading || (!form && (existing || (vr && !duplicate)))) return <LoadingState />;
  if (!existing && me && !canCreate) return <div className="panel"><EmptyState icon={AlertCircle} title="Only Inspectors can create reports" description="Sr. Staff review reports and QA Managers approve them." /></div>;
  if (duplicate) return <div className="panel"><EmptyState icon={AlertCircle} title="A report already exists for this verification"><Button asChild><Link to={`/reports/${duplicate.id}`}>Open {duplicate.report_number}</Link></Button></EmptyState></div>;
  if (!vr || !form) return <div className="panel"><EmptyState icon={AlertCircle} title="Verification record not found" /></div>;

  const canEdit = isAdmin || (!existing ? canCreate : me?.role === 'user' && existing.created_by_id === me?.id && ['draft', 'rejected'].includes(existing.status));
  const keepStatus = existing && !['draft', 'rejected'].includes(existing.status);
  const snapshot = existing?.equipment_snapshot || Object.fromEntries(SNAP_KEYS.map((k) => [k, eq?.[k] || vr[k] || '']));

  const save = async (status) => {
    const num = form.report_number.trim();
    if (!num) return setError('Report name is required');
    if (reports.some((r) => r.report_number === num && r.id !== existing?.id)) return setError('Report name already exists');
    setSaving(true);
    try {
    const payload = Object.fromEntries(Object.entries({
      report_number: num, equipment_id: vr.equipment_id, verification_id: vr.id, status, equipment_snapshot: snapshot,
      report_template: form.report_template,
      previous_verification_date: vr.previous_verification_date, verification_date: vr.verification_date, next_due_date: vr.next_due_date,
      verification_type: eq?.calibration_type || existing?.verification_type, verification_method: form.verification_method, result: vr.result, report_data: form.report_data,
      findings: form.findings, remarks: form.remarks, verified_by: vr.verified_by_name, checked_by: form.checked_by,
      reviewed_by: form.reviewed_by, approved_by: form.approved_by,
      ...(status === 'submitted' && existing?.status !== 'submitted' ? { submitted_at: new Date().toISOString(), rejection_reason: '' } : {}),
    }).filter(([, v]) => v !== undefined && v !== null));
    let saved;
    if (existing) saved = await apiClient.entities.Report.update(existing.id, payload);
    else saved = await apiClient.entities.Report.create({ ...payload, created_by_name: me?.full_name || me?.email });
    const rid = existing?.id || saved.id;
    const action = !existing ? 'report_create' : status === 'submitted' && existing.status !== 'submitted' ? 'report_submit' : 'report_update';
    await logAudit(me, { action, entity_type: 'Report', entity_id: rid, equipment_id: vr.equipment_id, entity_label: num, details: `Status: ${status}` });
    if (!existing && status === 'submitted') await logAudit(me, { action: 'report_submit', entity_type: 'Report', entity_id: rid, equipment_id: vr.equipment_id, entity_label: num });
    invalidate('reports');
    toast.success(status === 'submitted' && !keepStatus ? 'Report submitted for review' : 'Report saved');
    navigate(`/reports/${rid}`);
    } catch (saveError) {
      setError(saveError.message || 'Could not save report');
      toast.error(saveError.message || 'Could not save report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link to={existing ? `/reports/${existing.id}` : `/equipment/${vr.equipment_id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-900 mb-4"><ArrowLeft className="h-3.5 w-3.5" />Back</Link>
      <PageHeader eyebrow={existing ? 'Edit Report' : 'New Report'} title="Verification Report" description={`${snapshot.equipment_code} · ${snapshot.equipment_name}`} />
      {existing?.status === 'rejected' && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><strong>Rejected:</strong> {existing.rejection_reason}</div>}
      {!canEdit && <div className="mb-6 rounded-lg border bg-slate-50 px-4 py-3 text-sm">This report can no longer be edited by you.</div>}
      <div className="grid lg:grid-cols-3 gap-6 fade-up">
        <div className="lg:col-span-2 panel p-6">
          <ReportFormFields form={form} setForm={setForm} disabled={!canEdit} isAdmin={isAdmin} error={error} standardEquipment={standardEquipment} equipment={{ ...eq, ...snapshot }} />
          {canEdit && (
            <div className="flex flex-wrap justify-end gap-2 mt-6 pt-6 border-t">
              {keepStatus ? (
                <Button onClick={() => save(existing.status)} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Changes</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => save('draft')} disabled={saving} className="gap-2"><Save className="h-4 w-4" />Save Draft</Button>
                  <Button onClick={() => save('submitted')} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit Report</Button>
                </>
              )}
            </div>
          )}
        </div>
        <ReportContextCard snapshot={snapshot} vr={vr} />
      </div>
    </div>
  );
}