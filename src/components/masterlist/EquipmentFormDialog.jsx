// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';
import { useMe, useInvalidate } from '@/hooks/useCalData';
import { calcNextDue, FIELD_LABELS } from '@/lib/calibration';
import { logAudit, diffChanges } from '@/lib/audit';
import EquipmentFormFields from '@/components/masterlist/EquipmentFormFields';
import { reportTemplateForEquipment } from '@/lib/reportTemplates';

const FIELDS = Object.keys(FIELD_LABELS);
const REQUIRED = ['equipment_code', 'equipment_name', 'category', 'location', 'department', 'calibration_type', 'frequency_months'];
const BLANK = { calibration_type: 'Calibration', frequency_months: 12 };

export default function EquipmentFormDialog({ open, onClose, equipment }) {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const isEdit = !!equipment?.id;

  useEffect(() => {
    if (open) { setForm(isEdit ? Object.fromEntries(FIELDS.map((f) => [f, equipment[f] ?? ''])) : BLANK); setErrors({}); }
  }, [open, equipment]);

  const validate = () => {
    const e = {};
    REQUIRED.forEach((f) => { if (!String(form[f] ?? '').trim()) e[f] = 'Required'; });
    if (form.serial_number && !/^[A-Za-z0-9\-/.\s]+$/.test(form.serial_number)) e.serial_number = 'Only letters, numbers, - / . allowed';
    if (Number(form.frequency_months) < 1 || Number(form.frequency_months) > 120) e.frequency_months = 'Must be 1–120 months';
    if (form.last_verification_date && form.next_due_date && form.next_due_date <= form.last_verification_date) e.next_due_date = 'Must be after last verification date';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
    const data = { ...form, report_template: reportTemplateForEquipment(form), equipment_code: form.equipment_code.trim(), frequency_months: Number(form.frequency_months), updated_by_name: me?.full_name || me?.email };
    if (data.last_verification_date && !data.next_due_date) data.next_due_date = calcNextDue(data.last_verification_date, data.frequency_months);
    if (!data.last_result) delete data.last_result;
    if (isEdit) {
      await apiClient.entities.Equipment.update(equipment.id, data);
      const changes = diffChanges(equipment, data, FIELDS);
      if (changes.length) await logAudit(me, { action: 'update', entity_type: 'Equipment', entity_id: equipment.id, equipment_id: equipment.id, entity_label: data.equipment_code, changes });
    } else {
      const created = await apiClient.entities.Equipment.create({ ...data, deleted: false, created_by_name: me?.full_name || me?.email });
      await logAudit(me, { action: 'create', entity_type: 'Equipment', entity_id: created.id, equipment_id: created.id, entity_label: data.equipment_code, details: data.equipment_name });
    }
    invalidate('equipment');
    toast.success(isEdit ? 'Equipment updated' : 'Equipment added');
    onClose();
    } catch (saveError) {
      toast.error(saveError.message || 'Could not save equipment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? `Edit ${equipment.equipment_code}` : 'Add Equipment'}</DialogTitle></DialogHeader>
        <EquipmentFormFields form={form} setForm={setForm} errors={errors} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEdit ? 'Save Changes' : 'Add Equipment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}