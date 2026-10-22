// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Printer, Download, Tag, Trash2, Loader2, FileX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { apiClient } from '@/api/apiClient';
import { useCalibrationData, useMe, useInvalidate } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';
import { downloadElementPdf } from '@/lib/pdf';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import ReportStatusBadge from '@/components/common/ReportStatusBadge';
import ReportDocument from '@/components/reports/VerificationReportDocument';
import ReportPreview from '@/components/reports/ReportPreview';
import AttachmentsPanel from '@/components/reports/AttachmentsPanel';
import ReviewActions from '@/components/reports/ReviewActions';

export default function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reports, isLoading } = useCalibrationData();
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const ref = useRef(null);
  const [busy, setBusy] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  // true only when the server has no Excel template for this equipment type yet -> show the old basic layout instead
  const [legacy, setLegacy] = useState(false);
  useEffect(() => { setLegacy(false); }, [id]);

  if (isLoading) return <LoadingState />;
  const r = reports.find((x) => x.id === id);
  if (!r) return <div className="panel"><EmptyState icon={FileX} title="Report not found" /></div>;
  const isAdmin = me?.role === 'admin';
  const own = r.created_by_id === me?.id && ['draft', 'rejected'].includes(r.status);
  const canEdit = isAdmin || own;
  const canEditAttachments = canEdit && ['draft', 'rejected'].includes(r.status);

  // PDF = the Excel template rendered by the server (frozen copy once approved)
  const savePdf = async () => {
    if (legacy) { setBusy('pdf'); await downloadElementPdf(ref.current, `${r.report_number}.pdf`); setBusy(''); return; }
    setBusy('pdf');
    try {
      const url = URL.createObjectURL(await apiClient.reports.pdf(r.id));
      const a = document.createElement('a'); a.href = url; a.download = `${r.report_number}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) { toast.error(error.message); } finally { setBusy(''); }
  };
  // opens the PDF in a new tab (the browser's PDF viewer has its own Print button). The tab is opened first, inside the click,
  // so the pop-up blocker allows it.
  const printPdf = async () => {
    if (legacy) { window.print(); return; }
    const tab = window.open('', '_blank');
    if (tab) tab.document.write('<p style="font-family:sans-serif;padding:24px">Generating report…</p>');
    setBusy('print');
    try {
      const url = URL.createObjectURL(await apiClient.reports.pdf(r.id));
      if (tab) tab.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (error) { if (tab) tab.close(); toast.error(error.message); } finally { setBusy(''); }
  };
  const del = async () => {
    await apiClient.entities.Report.delete(r.id);
    await logAudit(me, { action: 'report_delete', entity_type: 'Report', entity_id: r.id, equipment_id: r.equipment_id, entity_label: r.report_number });
    invalidate('reports');
    toast.success('Report deleted');
    navigate('/reports');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          <div><p className="font-mono font-semibold">{r.report_number}</p><Link to={`/equipment/${r.equipment_id}`} className="text-xs text-muted-foreground hover:text-primary">{r.equipment_snapshot?.equipment_name}</Link></div>
          <ReportStatusBadge status={r.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button variant="outline" asChild className="gap-2"><Link to={`/reports/${r.id}/edit`}><Pencil className="h-4 w-4" />Edit</Link></Button>}
          <Button variant="outline" className="gap-2" onClick={printPdf} disabled={busy === 'print'}>{busy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Print</Button>
          <Button variant="outline" className="gap-2" onClick={savePdf} disabled={busy === 'pdf'}>{busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}PDF</Button>
          {r.status === 'approved' && <Button asChild className="gap-2"><Link to={`/sticker/${r.id}`}><Tag className="h-4 w-4" />Sticker</Link></Button>}
          {canEdit && <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>
      {r.status === 'rejected' && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 no-print"><strong>Rejected:</strong> {r.rejection_reason} {own && '— edit and resubmit this report.'}</div>}
      <ReviewActions report={r} />

      {legacy ? (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 no-print">No Excel template is set up for this equipment type yet, so the basic layout is shown.</div>
          <div className="overflow-x-auto"><ReportDocument ref={ref} report={r} /></div>
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="panel p-4">
            <ReportPreview report={r} onUnavailable={() => setLegacy(true)} />
          </div>
          <AttachmentsPanel report={r} canEdit={canEditAttachments} onChange={() => invalidate('reports')} />
        </div>
      )}

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this report?</AlertDialogTitle><AlertDialogDescription>{r.report_number} will be permanently removed. The verification record remains in history.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}