import React, { useMemo, useState, useEffect } from 'react';
import { Plus, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalibrationData, useIsAdmin } from '@/hooks/useCalData';
import { filterEquipment, EMPTY_FILTERS, getMasterColumns, toExportRow, norm } from '@/lib/masterlistFilter';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import Pager from '@/components/common/Pager';
import ExportMenu from '@/components/common/ExportMenu';
import MasterlistFilters from '@/components/masterlist/MasterlistFilters';
import MasterlistTable from '@/components/masterlist/MasterlistTable';
import EquipmentFormDialog from '@/components/masterlist/EquipmentFormDialog';
import DeleteEquipmentDialog from '@/components/masterlist/DeleteEquipmentDialog';

const PAGE = 15;
const uniqSorted = (list, key) => [...new Set(list.map((e) => norm(e[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

export default function Masterlist() {
  const { equipment, isLoading } = useCalibrationData();
  const isAdmin = useIsAdmin();
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, status: params.get('status') || 'all', report: params.get('report') || 'all', from: params.get('from') || '', to: params.get('to') || '' });
  const [sort, setSort] = useState({ key: 'next_due', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => setPage(1), [search, filters]);
  const rows = useMemo(() => filterEquipment(equipment, search, filters, sort), [equipment, search, filters, sort]);
  const columns = useMemo(() => getMasterColumns(equipment), [equipment]);
  const equipmentTypes = useMemo(() => uniqSorted(equipment, 'equipment_name'), [equipment]);
  const locations = useMemo(() => uniqSorted(equipment, 'location'), [equipment]);
  const checkingTypes = useMemo(() => uniqSorted(equipment, 'calibration_type'), [equipment]);
  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  return (
    <div>
      <PageHeader eyebrow="Equipment Register" title="Calibration Masterlist" description="All controlled equipment with live calibration/verification status, computed daily from due dates.">
        <ExportMenu getData={() => ({ title: 'Calibration Masterlist', filename: 'calibration-masterlist', columns, rows: rows.map(toExportRow) })} />
        {isAdmin && <Button className="gap-2" onClick={() => setEditing({})}><Plus className="h-4 w-4" />Add Equipment</Button>}
      </PageHeader>
      <div className="space-y-4 fade-up">
        <MasterlistFilters search={search} setSearch={setSearch} filters={filters} setFilters={setFilters} equipmentTypes={equipmentTypes} locations={locations} checkingTypes={checkingTypes} />
        {isLoading ? <LoadingState /> : rows.length === 0 ? (
          <div className="panel"><EmptyState icon={SearchX} title="No equipment found" description="Try adjusting your search or filters." /></div>
        ) : (
          <>
            <MasterlistTable rows={rows.slice((page - 1) * PAGE, page * PAGE)} columns={columns} isAdmin={isAdmin} sort={sort} onSort={onSort} onEdit={setEditing} onDelete={setDeleting} />
            <Pager page={page} pageSize={PAGE} total={rows.length} onChange={setPage} />
          </>
        )}
      </div>
      {isAdmin && <EquipmentFormDialog open={!!editing} equipment={editing} allEquipment={equipment} onClose={() => setEditing(null)} />}
      {isAdmin && <DeleteEquipmentDialog equipment={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}