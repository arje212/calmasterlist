import React, { useMemo, useState, useEffect } from 'react';
import { Plus, SearchX, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalibrationData, useIsAdmin } from '@/hooks/useCalData';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import Pager from '@/components/common/Pager';
import ExportMenu from '@/components/common/ExportMenu';
import StandardEquipmentFormDialog from '@/components/masterlist/StandardEquipmentFormDialog';

const PAGE = 15;
const COLUMNS = [
  { key: 'control_number', label: 'Control No.' }, { key: 'equipment_type', label: 'Equipment Type' }, { key: 'maker_model', label: 'Maker / Model' },
  { key: 'serial_number', label: 'Serial No.' }, { key: 'accuracy', label: 'Equipment Accuracy' }, { key: 'calibrated_by', label: 'Calibrated By' },
  { key: 'traceability', label: 'Traceability' }, { key: 'certificate_number', label: 'Certificate No.' }, { key: 'range', label: 'Range' }, { key: 'location', label: 'Location' },
];

export default function StandardMasterlist() {
  const { standardEquipment, isLoading } = useCalibrationData();
  const isAdmin = useIsAdmin();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  useEffect(() => setPage(1), [search]);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return standardEquipment;
    return standardEquipment.filter((standard) => COLUMNS.some(({ key }) => String(standard[key] || '').toLowerCase().includes(query)));
  }, [search, standardEquipment]);
  const exportRows = rows.map((row) => Object.fromEntries(COLUMNS.map(({ key }) => [key, row[key] || ''])));

  return <div>
    <PageHeader eyebrow="Equipment Register" title="Standard Masterlist" description="Approved standard equipment available for verification reports.">
      <ExportMenu getData={() => ({ title: 'Standard Equipment Masterlist', filename: 'standard-equipment-masterlist', columns: COLUMNS, rows: exportRows })} />
      {isAdmin && <Button className="gap-2" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add Standard</Button>}
    </PageHeader>
    <div className="space-y-4 fade-up">
      <div className="panel p-4"><div className="relative max-w-md"><Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search standard equipment..." className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></div></div>
      {isLoading ? <LoadingState /> : rows.length === 0 ? (
        <div className="panel"><EmptyState icon={SearchX} title="No standard equipment found" description="Add a standard or adjust your search." /></div>
      ) : (
        <>
          <div className="hidden overflow-x-auto panel md:block">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-slate-50/70">{COLUMNS.map((column) => <th key={column.key} className="px-4 py-3 text-left font-medium"><span className="eyebrow">{column.label}</span></th>)}</tr></thead>
              <tbody>{rows.slice((page - 1) * PAGE, page * PAGE).map((standard) => (
                <tr key={standard.id} className="border-b last:border-0 hover:bg-blue-50/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] font-medium text-primary">{standard.control_number}</td>
                  {COLUMNS.slice(1).map((column) => <td key={column.key} className="whitespace-pre-line px-4 py-3 text-xs">{standard[column.key] || '—'}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">{rows.slice((page - 1) * PAGE, page * PAGE).map((standard) => (
            <div key={standard.id} className="panel p-4">
              <p className="font-mono text-xs font-semibold text-primary">{standard.control_number}</p>
              <p className="mt-1 font-medium">{standard.equipment_type}</p>
              <p className="text-xs text-muted-foreground">{standard.maker_model} · S/N {standard.serial_number || '—'}</p>
              <p className="mt-3 whitespace-pre-line text-xs">{standard.accuracy || '—'}</p>
            </div>
          ))}</div>
          <Pager page={page} pageSize={PAGE} total={rows.length} onChange={setPage} />
        </>
      )}
    </div>
    {isAdmin && <StandardEquipmentFormDialog open={adding} onClose={() => setAdding(false)} />}
  </div>;
}
