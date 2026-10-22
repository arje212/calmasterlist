import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { apiClient } from '@/api/apiClient';
import { useMe, useInvalidate } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';

export default function DeleteEquipmentDialog({ equipment, onClose, onDeleted }) {
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);

  const confirm = async (ev) => {
    ev.preventDefault();
    setBusy(true);
    await apiClient.entities.Equipment.update(equipment.id, { deleted: true, deleted_at: new Date().toISOString(), updated_by_name: me?.full_name || me?.email });
    await logAudit(me, { action: 'delete', entity_type: 'Equipment', entity_id: equipment.id, equipment_id: equipment.id, entity_label: equipment.equipment_code, details: `${equipment.equipment_name} (soft delete)` });
    invalidate('equipment');
    setBusy(false);
    toast.success('Equipment deleted');
    onClose();
    onDeleted?.();
  };

  return (
    <AlertDialog open={!!equipment} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this equipment?</AlertDialogTitle>
          <AlertDialogDescription>
            {equipment?.equipment_code} — {equipment?.equipment_name} will be removed from the masterlist. Its verification history and reports are retained for audit purposes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={busy} className="bg-red-600 hover:bg-red-700">{busy ? 'Deleting…' : 'Delete Equipment'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}