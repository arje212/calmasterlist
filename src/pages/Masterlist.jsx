import React, { useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const SIZES = [15, 25, 50, 100];
const DEFAULT_SIZE = 15;
const FILTER_KEYS = Object.keys(EMPTY_FILTERS);
const DEFAULTS = { ...EMPTY_FILTERS, q: '', sort: 'next_due', dir: 'asc', size: DEFAULT_SIZE, page: 1 };
const uniqSorted = (list, key) => [...new Set(list.map((e) => norm(e[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

// Search, filters, sort, page and page size all live in the URL, so a filtered view can be bookmarked,
// shared, and survives the Back button and a refresh. Dashboard links (?status=expired etc.) use the same keys.
export default function Masterlist() {
  const { equipment, isLoading } = useCalibrationData();
  const isAdmin = useIsAdmin();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);

  const search = params.get('q') || '';
  const filters = useMemo(() => {
    const f = { ...EMPTY_FILTERS };
    FILTER_KEYS.forEach((k) => { const v = params.get(k); if (v) f[k] = v; });
    return f;
  }, [params]);
  const sort = { key: params.get('sort') || DEFAULTS.sort, dir: params.get('dir') === 'desc' ? 'desc' : 'asc' };
  const size = SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : DEFAULT_SIZE;
  const requestedPage = Math.max(1, parseInt(params.get('page'), 10) || 1);

  const update = (changes, { resetPage = true, replace = true } = {}) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    Object.entries(changes).forEach(([k, v]) => { if (v === '' || v == null || v === DEFAULTS[k]) next.delete(k); else next.set(k, String(v)); });
    if (resetPage && !('page' in changes)) next.delete('page');
    return next;
  }, { replace });

  const setSearch = (q) => update({ q });
  const setFilters = (f) => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, f[k]])));
  const onSort = (key) => update({ sort: key, dir: sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc' }, { resetPage: false, replace: false });

  const rows = useMemo(() => filterEquipment(equipment, search, filters, sort), [equipment, search, filters, sort.key, sort.dir]);
  const columns = useMemo(() => getMasterColumns(equipment), [equipment]);
  const equipmentTypes = useMemo(() => uniqSorted(equipment, 'equipment_name'), [equipment]);
  const locations = useMemo(() => uniqSorted(equipment, 'location'), [equipment]);
  const checkingTypes = useMemo(() => uniqSorted(equipment, 'calibration_type'), [equipment]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(requestedPage, pages);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, size]);

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
            <MasterlistTable rows={rows.slice((page - 1) * size, page * size)} columns={columns} isAdmin={isAdmin} sort={sort} onSort={onSort} onEdit={setEditing} onDelete={setDeleting} />
            <Pager page={page} pageSize={size} total={rows.length} onChange={(p) => update({ page: p }, { resetPage: false, replace: false })} onPageSizeChange={(n) => update({ size: n })} pageSizeOptions={SIZES} />
          </>
        )}
      </div>
      {isAdmin && <EquipmentFormDialog open={!!editing} equipment={editing} allEquipment={equipment} onClose={() => setEditing(null)} />}
      {isAdmin && <DeleteEquipmentDialog equipment={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
