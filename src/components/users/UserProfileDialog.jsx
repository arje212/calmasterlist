import React, { useEffect, useRef, useState } from 'react';
import { Eraser, Loader2, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UserProfileDialog({ user, onClose, onSave }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [signatureChanged, setSignatureChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name || '');
    setPosition(user.position || '');
    setSignatureData('');
    setSignatureChanged(false);
    setError('');
  }, [user]);

  const point = (event) => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height };
  };
  const startDrawing = (event) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const { x, y } = point(event);
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(x, y);
    drawing.current = true;
  };
  const draw = (event) => {
    if (!drawing.current) return;
    const context = canvasRef.current.getContext('2d');
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  };
  const finishDrawing = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setSignatureData(canvasRef.current.toDataURL('image/png'));
    setSignatureChanged(true);
  };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
    setSignatureChanged(true);
  };
  const save = async () => {
    const name = fullName.trim();
    if (!name) return setError('Enter the user\'s full name');
    setBusy(true);
    setError('');
    const values = { full_name: name, position: position.trim() };
    if (signatureChanged) values.signature_data = signatureData;
    const saved = await onSave(user, values);
    setBusy(false);
    if (saved) onClose();
    else setError('Could not save this profile. Please try again.');
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>User report identity</DialogTitle>
          <DialogDescription>Reports use the user name and verifier signature saved here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label className="text-xs">Full name</Label><Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Rolando Jr M. Melecio" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Position</Label><Input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="QA Sr. Staff" /></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-xs">Verifier signature</Label><Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={clearSignature}><Eraser className="h-3.5 w-3.5" />Clear</Button></div>
            <canvas
              ref={canvasRef}
              width="600"
              height="150"
              aria-label="Draw verifier signature"
              className="h-32 w-full touch-none rounded-md border bg-white"
              style={{ touchAction: 'none' }}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={finishDrawing}
              onPointerCancel={finishDrawing}
            />
            <p className="text-xs text-muted-foreground">{user?.has_signature && !signatureChanged ? 'A saved signature will be kept unless you draw a replacement or clear it.' : 'Draw your signature above using a mouse, pen, or touch screen.'}</p>
            {signatureData && <div className="flex items-center gap-2 text-xs text-emerald-700"><PenLine className="h-3.5 w-3.5" />New signature ready to save</div>}
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Profile</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}