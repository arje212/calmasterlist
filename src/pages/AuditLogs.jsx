import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ScrollText } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/api/apiClient';
import { ACTION_LABELS } from '@/lib/audit';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import ExportMenu from '@/components/common/ExportMenu';
import Pager from '@/components/common/Pager';
import AuditEntry from '@/components/audit/AuditEntry';

export default function AuditLogs() {
  const { data: logs = [], isLoading } = useQuery({ queryKey: ['audit-all'], queryFn: () => apiClient.entities.AuditLog.list('-created_date', 2000) });
  const [q, setQ] = useState('');
  const [action, setAction] = useState('all');
  const [page, setPage] = useState(1);
  const rows = logs.filter((l) => (action === 'all' || l.action === action) &&
    (!q || [l.user_name, l.user_email, l.entity_label, l.details, l.entity_type].some((v) => (v || '').toLowerCase().includes(q.toLowerCase()))));
  const exportData = () => ({
    title: 'Audit Log', filename: 'audit-log',
    columns: [{ key: 'date', label: 'Date' }, { key: 'user_name', label: 'User' }, { key: 'user_role', label: 'Role' }, { key: 'act', label: 'Action' }, { key: 'entity_type', label: 'Entity' }, { key: 'entity_label', label: 'Record' }, { key: 'chg', label: 'Changes' }, { key: 'details', label: 'Details' }],
    rows: rows.map((l) => ({ ...l, date: format(new Date(l.created_date), 'yyyy-MM-dd HH:mm'), act: ACTION_LABELS[l.action] || l.action, chg: (l.changes || []).map((c) => `${c.field}: ${c.from} → ${c.to}`).join('; ') })),
  });

  return (
    <div>
      <PageHeader eyebrow="Compliance" title="Audit Log" description="Immutable record of every important action taken in the system.">
        <ExportMenu getData={exportData} />
      </PageHeader>
      <div className="panel p-4 mb-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search user, record, details…" className="pl-9" /></div>
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="md:w-60"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All actions</SelectItem>{Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {isLoading ? <LoadingState /> : rows.length === 0 ? <div className="panel"><EmptyState icon={ScrollText} title="No audit entries" /></div> : (
        <div className="panel px-5 divide-y fade-up">{rows.slice((page - 1) * 25, page * 25).map((l) => <AuditEntry key={l.id} log={l} />)}</div>
      )}
      <Pager page={page} pageSize={25} total={rows.length} onChange={setPage} />
    </div>
  );
}