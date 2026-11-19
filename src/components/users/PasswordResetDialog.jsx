import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MIN = 10;

// Replaces window.prompt for setting a temporary password: masked input, show/hide toggle, inline validation.
export default function PasswordResetDialog({ user, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) { setPassword(''); setVisible(false); setError(''); setBusy(false); } }, [user]);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < MIN) return setError(`Use at least ${MIN} characters.`);
    setBusy(true);
    setError('');
    try {
      const ok = await onSubmit(user, password);
      if (ok !== false) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Set temporary password</DialogTitle>
            <DialogDescription>For {user?.full_name || user?.id_number || user?.username || user?.email}. Share it with them directly; they should change it after logging in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="temp-password">Temporary password</Label>
            <div className="relative">
              <Input id="temp-password" type={visible ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className="pr-11" aria-invalid={!!error} aria-describedby="temp-password-hint" />
              <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}
                className="absolute right-1 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p id="temp-password-hint" className={`text-xs ${error ? 'text-red-600' : 'text-muted-foreground'}`} role={error ? 'alert' : undefined}>{error || `At least ${MIN} characters.`}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Set password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
