import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MasterlistCard from '@/components/masterlist/MasterlistCard';
import { toExportRow } from '@/lib/masterlistFilter';

export default function MasterlistTable({ rows, columns, isAdmin, sort, onSort, onEdit, onDelete }) {
  const navigate = useNavigate();
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (
    <>
      <div className="hidden md:block panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50/70">
              {columns.map((c) => (
                <th key={c.key} className="text-left px-4 py-3 font-medium">
                  {c.sortKey ? (
                    <button onClick={() => onSort(c.sortKey)} className={`eyebrow inline-flex items-center gap-1 hover:text-slate-900 ${sort.key === c.sortKey ? 'text-primary' : ''}`}>
                      {c.label}<ArrowUpDown className="h-3 w-3" />
                    </button>
                  ) : <span className="eyebrow">{c.label}</span>}
                </th>
              ))}
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const display = toExportRow(e);
              return (
              <tr key={e.id} onClick={() => navigate(`/equipment/${e.id}`)} className="border-b last:border-0 hover:bg-blue-50/40 cursor-pointer transition-colors">
                {columns.map((column) => <td key={`${e.id}-${column.key}`} className="px-4 py-3 text-[11px] whitespace-nowrap">{display[column.key] || '—'}</td>)}
                {isAdmin && (
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stop(() => onEdit(e))}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={stop(() => onDelete(e))}><Trash2 className="h-3.5 w-3.5" /></Button>
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