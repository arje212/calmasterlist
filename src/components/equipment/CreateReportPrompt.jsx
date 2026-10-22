import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/useCalData';

export default function CreateReportPrompt({ verification, onClose }) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const canCreateReport = me?.role === 'admin' || me?.role === 'user';
  const later = () => {
    toast.warning('Report Required — this equipment is flagged until a report is approved.');
    onClose();
  };
  return (
    <Dialog open={!!verification} onOpenChange={(o) => !o && later()}>
      <DialogContent className="max-w-md text-center p-8">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold">Verification date updated successfully.</h2>
        <p className="text-sm text-muted-foreground">{canCreateReport ? 'Would you like to create a Verification Report for this equipment?' : 'The Inspector will create the Verification Report for this equipment.'}</p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={later}>LATER</Button>
          {canCreateReport && <Button className="flex-1 gap-2" onClick={() => navigate(`/reports/new?verification=${verification.id}`)}>
            <FileText className="h-4 w-4" />CREATE REPORT
          </Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}