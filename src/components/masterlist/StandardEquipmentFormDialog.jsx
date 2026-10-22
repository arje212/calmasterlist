import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/api/apiClient';
import { useMe, useInvalidate } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';

const BLANK = {
  control_number: '', equipment_type: '', maker_model: '', serial_number: '', accuracy: '',
  calibrated_by: '', traceability: '', certificate_number: '', range: '', location: '',
};
const FIELDS = [
  ['control_number', 'Control No. *'], ['equipment_type', 'Equipment Type *'], ['maker_model', 'Maker / Model'],
  ['serial_number', 'Serial No.'], ['accuracy', 'Equipment Accuracy'], ['calibrated_by', 'Calibrated By'],
  ['traceability', 'Traceability'], ['certificate_number', 'Certificate No.'], ['range', 'Range'], ['location', 'Location'],
];

export default function StandardEquipmentFormDialog({ open, onClose, onSaved }) {
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(BLANK); setError(''); }
  }, [open]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!form.control_number.trim() || !form.equipment_type.trim()) return setError('Control number and equipment type are required.');
    setSaving(true);
    setError('');
    try {
      const record = await apiClient.entities.StandardEquipment.create(form);
      await logAudit(me, { action: 'create', entity_type: 'StandardEquipment', entity_id: record.id, entity_label: record.control_number, details: record.equipment_type });
      invalidate('standard-equipment');
      toast.success('Standard equipment added');
      onSaved?.(record);
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Could not add standard equipment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !saving && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Standard Equipment</DialogTitle>
          <DialogDescription>Add an approved standard for use in verification reports.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`standard-${key}`} className="text-xs">{label}</Label>
              <Input id={`standard-${key}`} value={form[key]} onChange={(event) => set(key, event.target.value)} />
            </div>
          ))}
        </div>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Standard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
