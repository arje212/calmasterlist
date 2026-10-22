import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AuditEntry from '@/components/audit/AuditEntry';

export default function UserActivityDialog({ user, logs, onClose }) {
  const mine = user ? logs.filter((l) => l.user_email === user.email) : [];
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Activity — {user?.full_name || user?.email}</DialogTitle></DialogHeader>
        {mine.length === 0 ? <p className="text-sm text-muted-foreground py-6">No recorded activity.</p> : <div className="divide-y">{mine.slice(0, 100).map((l) => <AuditEntry key={l.id} log={l} />)}</div>}
      </DialogContent>
    </Dialog>
  );
}