import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/api/apiClient';
import { logAudit } from '@/lib/audit';

export default function InviteUserDialog({ open, onClose, me }) {
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const invite = async () => {
    const trimmed = idNumber.trim();
    if (!trimmed) return setError('Enter an ID number');
    if (password.length < 8) return setError('Use a temporary password with at least 8 characters');
    setBusy(true);
    setError('');
    try {
      await apiClient.users.inviteUser(trimmed, role, password);
      await logAudit(me, { action: 'user_invite', entity_type: 'User', entity_label: trimmed, details: `Role: ${role}` });
      toast.success(`User created with ID ${trimmed}`);
      setIdNumber('');
      setPassword('');
      onClose();
    } catch (e) {
      setError(e?.message || 'Could not create user');
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create User</DialogTitle><DialogDescription>Create an account with an ID number and temporary password. Share it directly with the user.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label className="text-xs">ID Number</Label><Input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="Enter ID number" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Temporary Password</Label><Input type="password" autoComplete="new-password" minLength={8} maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">Use 8–256 characters.</p></div>
          <div className="space-y-1.5"><Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="user">STAFF / INSPECTOR</SelectItem><SelectItem value="sr_staff">SR. STAFF</SelectItem><SelectItem value="qa_manager">QA MANAGER</SelectItem><SelectItem value="admin">ADMIN</SelectItem></SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={invite} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create User</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}