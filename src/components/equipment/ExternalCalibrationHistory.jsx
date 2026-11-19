import React from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/common/EmptyState';
import { RESULT_META, fmtDate } from '@/lib/calibration';

const STAGES = { planned: 'Planned', sent: 'With Provider', returned: 'Returned', certificate_review: 'Certificate Review', completed: 'Completed' };
const displayStatus = (cycle) => cycle.status === 'returned' && cycle.certificate_file && cycle.calibration_date && cycle.calibration_result && cycle.certificate_number ? 'certificate_review' : cycle.status;

export default function ExternalCalibrationHistory({ cycles, onOpen }) {
  const history = cycles.slice().sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
  return (
    <section className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div><p className="eyebrow">External Calibration History</p><p className="mt-1 text-xs text-muted-foreground">Provider dispatch, return, result, and certificate review.</p></div>
        <span className="font-mono text-xs text-muted-foreground">{history.length} cycles</span>
      </div>
      {!history.length ? <EmptyState icon={CalendarClock} title="No external cycles yet" description="Start an external calibration from this equipment." /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className="border-b text-left">{['Provider', 'Status', 'Sent', 'Returned', 'Result', 'Certificate', 'Next Due', ''].map((heading) => <th key={heading || 'action'} className="eyebrow py-2 pr-4 font-medium">{heading}</th>)}</tr></thead>
            <tbody>{history.map((cycle) => (
                <tr key={cycle.id} className="border-b last:border-0">
                <td className="py-3 pr-4 font-medium">{cycle.provider}</td>
                  <td className="py-3 pr-4"><span className={`rounded px-2 py-1 text-xs font-semibold ${displayStatus(cycle) === 'completed' ? 'bg-emerald-50 text-emerald-700' : displayStatus(cycle) === 'certificate_review' ? 'bg-violet-50 text-violet-700' : displayStatus(cycle) === 'returned' ? 'bg-orange-50 text-orange-700' : displayStatus(cycle) === 'sent' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{STAGES[displayStatus(cycle)] || cycle.status}</span>{cycle.certificate_review_status === 'rejected' && <p className="mt-1 text-xs text-red-600">Certificate rejected</p>}</td>
                <td className="py-3 pr-4 font-mono text-xs">{fmtDate(cycle.sent_date)}</td>
                <td className="py-3 pr-4 font-mono text-xs">{fmtDate(cycle.returned_date)}</td>
                <td className="py-3 pr-4">{RESULT_META[cycle.calibration_result]?.label || '—'}</td>
                <td className="py-3 pr-4 text-xs">{cycle.certificate_number || cycle.certificate_file?.original_name || '—'}</td>
                <td className="py-3 pr-4 font-mono text-xs">{fmtDate(cycle.next_due_date)}</td>
                <td className="py-3 text-right"><Button size="sm" variant="ghost" onClick={() => onOpen(cycle)}>View</Button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
