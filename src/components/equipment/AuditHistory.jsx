import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { apiClient } from '@/api/apiClient';
import AuditEntry from '@/components/audit/AuditEntry';
import EmptyState from '@/components/common/EmptyState';

export default function AuditHistory({ equipmentId }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['audit', equipmentId],
    queryFn: () => apiClient.entities.AuditLog.filter({ equipment_id: equipmentId }, '-created_date', 100),
  });
  return (
    <div className="panel p-6">
      <p className="eyebrow mb-2">Audit History</p>
      {isLoading ? <p className="text-xs text-muted-foreground py-6">Loading…</p> : data.length === 0 ? <EmptyState icon={ScrollText} title="No changes recorded" /> : (
        <div className="divide-y max-h-[520px] overflow-y-auto pr-2">
          {data.map((l) => <AuditEntry key={l.id} log={l} showEntity={false} />)}
        </div>
      )}
    </div>
  );
}