import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MasterlistCard from '@/components/masterlist/MasterlistCard';
import { toExportRow } from '@/lib/masterlistFilter';

const STICKY = 'sticky left-0 z-10';

export default function MasterlistTable({ rows, columns, isAdmin, sort, onSort, onEdit, onDelete }) {
  const navigate = useNavigate();
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const ariaSort = (c) => (c.sortKey ? (sort.key === c.sortKey ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined);
  return (
    <>
      <div className="hidden md:block panel overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Calibration masterlist. Select a control number to open the equipment record.</caption>
          <thead>
            <tr className="border-b bg-slate-50">
              {columns.map((c) => {
                const Arrow = sort.key === c.sortKey ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th key={c.key} scope="col" aria-sort={ariaSort(c)} className={`text-left px-4 py-3 font-medium ${c.key === 'control_no' ? `${STICKY} bg-slate-50` : ''}`}>
                    {c.sortKey ? (
                      <button type="button" onClick={() => onSort(c.sortKey)} className={`eyebrow inline-flex items-center gap-1 rounded hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sort.key === c.sortKey ? 'text-primary' : ''}`}>
                        {c.label}<Arrow className="h-3 w-3" aria-hidden="true" />
                      </button>
                    ) : <span className="eyebrow">{c.label}</span>}
                  </th>
                );
              })}
              {isAdmin && <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const display = toExportRow(e);
              return (
                <tr key={e.id} onClick={() => navigate(`/equipment/${e.id}`)} className="group border-b last:border-0 hover:bg-blue-50/40 cursor-pointer transition-colors">
                  {columns.map((column) => (
                    <td key={`${e.id}-${column.key}`} className={`px-4 py-3 text-[13px] whitespace-nowrap ${column.key === 'control_no' ? `${STICKY} bg-white group-hover:bg-blue-50` : ''}`}>
                      {column.key === 'control_no' && display[column.key]
                        ? <Link to={`/equipment/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="font-mono font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">{display[column.key]}</Link>
                        : (display[column.key] || '—')}
                    </td>
                  ))}
                  {isAdmin && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${e.equipment_code}`} onClick={stop(() => onEdit(e))}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:text-red-700" aria-label={`Delete ${e.equipment_code}`} onClick={stop(() => onDelete(e))}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">
        {rows.map((e) => <MasterlistCard key={e.id} e={e} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </>
  );
}
