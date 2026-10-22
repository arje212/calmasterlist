import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function RejectDialog({ open, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Report</DialogTitle>
          <DialogDescription>Provide a reason. The author will be able to revise and resubmit.</DialogDescription>
        </DialogHeader>
        <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Findings section missing reference standard details." />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-red-600 hover:bg-red-700" disabled={!reason.trim() || busy} onClick={() => onConfirm(reason.trim())}>Reject Report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}