import React, { useState } from 'react';
import { CheckCheck, Eye, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';
import { useMe, useInvalidate } from '@/hooks/useCalData';
import RejectDialog from '@/components/reports/RejectDialog';

export default function ReviewActions({ report }) {
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  if (!['submitted', 'reviewed'].includes(report.status)) return null;
  const isAdmin = me?.role === 'admin';
  const canReview = isAdmin || me?.role === 'sr_staff';
  const canApprove = isAdmin || me?.role === 'qa_manager';
  if ((report.status === 'submitted' && !canReview) || (report.status === 'reviewed' && !canApprove)) return null;

  const act = async (data, label) => {
    setBusy(true);
    try {
      await apiClient.entities.Report.update(report.id, data);
      invalidate('reports');
      setRejecting(false);
      toast.success(label);
    } catch (error) {
      toast.error(error.message || 'Could not update report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel p-5 no-print border-blue-200 bg-blue-50/40">
      <p className="eyebrow mb-1 text-blue-800">{isAdmin ? 'Administrator Actions' : report.status === 'submitted' ? 'Sr. Staff Review' : 'QA Manager Approval'}</p>
      <p className="text-sm text-muted-foreground mb-4">{isAdmin ? 'Manage this report and override its workflow status.' : report.status === 'submitted' ? 'Review this report before sending it to the QA Manager.' : 'Approve or reject this reviewed report.'}</p>
      <div className="flex flex-wrap gap-2">
        {report.status === 'submitted' && canReview && (
          <Button variant="outline" disabled={busy} className="gap-2" onClick={() => act({ status: 'reviewed' }, 'Report marked as reviewed')}><Eye className="h-4 w-4" />Mark Reviewed</Button>
        )}
        {canApprove && (report.status === 'reviewed' || isAdmin) && <Button disabled={busy} className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => act({ status: 'approved', rejection_reason: '' }, 'Report approved — sticker is now available')}><CheckCheck className="h-4 w-4" />Approve</Button>}
        {(canReview || canApprove) && <Button disabled={busy} variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejecting(true)}><XCircle className="h-4 w-4" />Reject</Button>}
      </div>
      <RejectDialog open={rejecting} busy={busy} onClose={() => setRejecting(false)} onConfirm={(reason) => act({ status: 'rejected', rejection_reason: reason }, 'Report rejected')} />
    </div>
  );
}