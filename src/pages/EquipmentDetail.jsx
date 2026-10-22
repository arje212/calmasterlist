import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardCheck, Pencil, Trash2, PackageX, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/api/apiClient';
import { useMe, useInvalidate, useExternalCalibrations } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';
import { useCalibrationData, useIsAdmin } from '@/hooks/useCalData';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import StatusHero from '@/components/equipment/StatusHero';
import EquipmentInfoGrid from '@/components/equipment/EquipmentInfoGrid';
import HistoryTable from '@/components/equipment/HistoryTable';
import EquipmentReports from '@/components/equipment/EquipmentReports';
import AuditHistory from '@/components/equipment/AuditHistory';
import VerifyDialog from '@/components/equipment/VerifyDialog';
import CreateReportPrompt from '@/components/equipment/CreateReportPrompt';
import EquipmentFormDialog from '@/components/masterlist/EquipmentFormDialog';
import DeleteEquipmentDialog from '@/components/masterlist/DeleteEquipmentDialog';
import ExternalCalibrationWorkflowDialog from '@/components/equipment/ExternalCalibrationWorkflowDialog';
import ExternalCalibrationHistory from '@/components/equipment/ExternalCalibrationHistory';
import { isExternalCalibration } from '@/lib/calibration';

export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { equipment, reports, isLoading } = useCalibrationData();
  const initialEquipment = equipment.find((item) => item.id === id);
  const isExternal = isExternalCalibration(initialEquipment);
  const { data: externalCycles = [], isLoading: externalCyclesLoading } = useExternalCalibrations({ enabled: isExternal });
  const isAdmin = useIsAdmin();
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const [verifying, setVerifying] = useState(false);
  const [savedVr, setSavedVr] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [externalWorkflowOpen, setExternalWorkflowOpen] = useState(false);
  const [selectedExternalCycle, setSelectedExternalCycle] = useState(null);

  if (isLoading || (isExternal && externalCyclesLoading)) return <LoadingState />;
  const e = equipment.find((x) => x.id === id);
  if (!e) return <div className="panel"><EmptyState icon={PackageX} title="Equipment not found" description="It may have been deleted."><Button asChild variant="outline"><Link to="/masterlist">Back to Masterlist</Link></Button></EmptyState></div>;
  const eqReports = reports.filter((r) => r.equipment_id === e.id);
  const equipmentExternalCycles = externalCycles.filter((cycle) => cycle.equipment_id === e.id).sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
  const activeExternalCycle = equipmentExternalCycles.find((cycle) => cycle.status !== 'completed') || null;
  const openExternalCycle = (cycle) => { setSelectedExternalCycle(cycle); setExternalWorkflowOpen(true); };
  const canInspect = isAdmin || me?.role === 'user';
  const canManageExternal = isAdmin || me?.role === 'user' || me?.role === 'sr_staff';
  const saveName = async (event) => {
    event.preventDefault();
    const equipmentName = nameDraft.trim();
    if (!equipmentName) return toast.error('Equipment name is required');
    if (equipmentName === e.equipment_name) return setRenaming(false);
    setSavingName(true);
    try {
      await apiClient.entities.Equipment.update(e.id, { equipment_name: equipmentName });
      await logAudit(me, { action: 'update', entity_type: 'Equipment', entity_id: e.id, equipment_id: e.id, entity_label: e.equipment_code, changes: [{ field: 'Equipment Name', from: e.equipment_name, to: equipmentName }] });
      invalidate('equipment');
      setRenaming(false);
      toast.success('Equipment name updated');
    } catch (error) {
      toast.error(error.message || 'Could not update equipment name');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/masterlist" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-900 no-print"><ArrowLeft className="h-3.5 w-3.5" />Masterlist</Link>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-up">
        <div>
          <p className="font-mono text-sm text-primary font-medium">{e.equipment_code}</p>
          {renaming ? (
            <form onSubmit={saveName} className="flex items-center gap-1.5 max-w-xl">
              <Input autoFocus aria-label="Equipment name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} disabled={savingName} />
              <Button type="submit" size="icon" aria-label="Save equipment name" disabled={savingName}><Check className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Cancel editing equipment name" disabled={savingName} onClick={() => setRenaming(false)}><X className="h-4 w-4" /></Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{e.equipment_name}</h1>
              {!isAdmin && me?.role === 'user' && <Button variant="ghost" size="icon" aria-label="Edit equipment name" title="Edit equipment name" onClick={() => { setNameDraft(e.equipment_name); setRenaming(true); }}><Pencil className="h-4 w-4" /></Button>}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-1">{e.department} · {e.location}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <Button variant="outline" className="gap-2" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Edit</Button>}
          {isAdmin && <Button variant="outline" className="gap-2 text-red-600 hover:text-red-700" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" />Delete</Button>}
          {canManageExternal && isExternal
            ? <Button className="gap-2" onClick={() => openExternalCycle(activeExternalCycle)}><ClipboardCheck className="h-4 w-4" />{activeExternalCycle ? 'Continue External Calibration' : 'Start External Calibration'}</Button>
            : canInspect && <Button className="gap-2" onClick={() => setVerifying(true)}><ClipboardCheck className="h-4 w-4" />Record Verification</Button>}
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6 fade-up">
        <div className="lg:col-span-1 space-y-6"><StatusHero e={e} /><EquipmentReports reports={eqReports} /></div>
        <div className="lg:col-span-2 space-y-6">
          <EquipmentInfoGrid e={e} />
          {isExternal && <ExternalCalibrationHistory cycles={equipmentExternalCycles} onOpen={openExternalCycle} />}
          <HistoryTable history={e.history} reports={reports} />
          {isAdmin && <AuditHistory equipmentId={e.id} />}
        </div>
      </div>
      <VerifyDialog open={verifying} equipment={e} onClose={() => setVerifying(false)} onSaved={(vr) => { setVerifying(false); setSavedVr(vr); }} />
      <CreateReportPrompt verification={savedVr} onClose={() => setSavedVr(null)} />
      {isExternal && <ExternalCalibrationWorkflowDialog open={externalWorkflowOpen} equipment={e} cycle={selectedExternalCycle} onClose={() => { setExternalWorkflowOpen(false); setSelectedExternalCycle(null); }} />}
      {isAdmin && <EquipmentFormDialog open={editing} equipment={e} allEquipment={equipment} onClose={() => setEditing(false)} />}
      {isAdmin && <DeleteEquipmentDialog equipment={deleting ? e : null} onClose={() => setDeleting(false)} onDeleted={() => navigate('/masterlist')} />}
    </div>
  );
}