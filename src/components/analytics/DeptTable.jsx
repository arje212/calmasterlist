import React from 'react';

export default function DeptTable({ groups, title }) {
  return (
    <div className="panel p-6">
      <p className="eyebrow mb-4">{title}</p>
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="border-b text-left">{['Name', 'Equipment', 'Expired', 'Upcoming', 'Failed', 'Pending Reports', 'Compliance'].map((h) => <th key={h} className="eyebrow font-medium py-2 pr-4">{h}</th>)}</tr></thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.name} className="border-b last:border-0">
                <td className="py-3 pr-4 font-medium">{g.name}</td>
                <td className="py-3 pr-4 tabular-nums">{g.total}</td>
                <td className={`py-3 pr-4 tabular-nums ${g.expired ? 'text-red-600 font-semibold' : ''}`}>{g.expired}</td>
                <td className={`py-3 pr-4 tabular-nums ${g.upcoming ? 'text-orange-600' : ''}`}>{g.upcoming}</td>
                <td className={`py-3 pr-4 tabular-nums ${g.failed ? 'text-red-600' : ''}`}>{g.failed}</td>
                <td className="py-3 pr-4 tabular-nums">{g.pending}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${g.compliance}%` }} /></div><span className="font-mono text-xs">{g.compliance}%</span></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}