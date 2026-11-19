import React from 'react';
import { Link } from 'react-router-dom';
import { X, History } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import { useMe, useInvalidate } from '@/hooks/useCalData';
import { fmtDate } from '@/lib/calibration';
import { logAudit } from '@/lib/audit';
import ResultBadge from '@/components/common/ResultBadge';
import EmptyState from '@/components/common/EmptyState';
import AttachmentLink from '@/components/equipment/AttachmentLink';

export default function HistoryTable({ history, reports }) {
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const isAdmin = me?.role === 'admin';
  const reportFor = (vr) => reports.filter((r) => r.verification_id === vr.id).sort((a, b) => b.created_date.localeCompare(a.created_date))[0];

  const removeAttachment = async (vr) => {
    try {
      await apiClient.entities.VerificationRecord.update(vr.id, { attachment_uri: '', attachment_name: '' });
      await logAudit(me, { action: 'attachment_remove', entity_type: 'VerificationRecord', entity_id: vr.id, equipment_id: vr.equipment_id, entity_label: vr.equipment_code, details: vr.attachment_name });
      invalidate('verifications');
      toast.success('Attachment removed');
    } catch (error) {
      toast.error(error.message || 'Could not remove attachment');
    }
  };

  return (
    <div className="panel p-6">
      <p className="eyebrow mb-4">Calibration History</p>
      {history.length === 0 ? <EmptyState icon={History} title="No verification records yet" /> : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="border-b text-left">{['Date', 'Result', 'Report No.', 'Verified By', 'Remarks', 'Documents'].map((h) => <th key={h} className="eyebrow py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {history.map((vr) => {
                const r = reportFor(vr);
                return (
                  <tr key={vr.id} className="border-b last:border-0 align-top">
                    <td className="py-3 pr-4 font-mono text-[12px] whitespace-nowrap">{fmtDate(vr.verification_date)}<p className="text-xs text-muted-foreground">Next: {fmtDate(vr.next_due_date)}</p></td>
                    <td className="py-3 pr-4"><ResultBadge result={vr.result} /></td>
                    <td className="py-3 pr-4 font-mono text-[12px]">{r ? <Link className="text-primary hover:underline" to={`/reports/${r.id}`}>{r.report_number}</Link> : <span className="text-red-600 text-xs font-sans font-semibold">REPORT REQUIRED</span>}</td>
                    <td className="py-3 pr-4 text-[12px]">{vr.verified_by_name}</td>
                    <td className="py-3 pr-4 text-[12px] text-muted-foreground max-w-xs">{vr.remarks || vr.findings || '—'}</td>
                    <td className="py-3 pr-4">
                      {vr.attachment_uri ? (
                        <div className="flex items-center gap-1"><AttachmentLink uri={vr.attachment_uri} name={vr.attachment_name} />
                          {isAdmin && <button onClick={() => removeAttachment(vr)} className="text-slate-400 hover:text-red-600" title="Remove"><X className="h-3 w-3" /></button>}
                        </div>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}