import React from 'react';

const tone = (p) => (p >= 90 ? 'bg-emerald-500' : p >= 75 ? 'bg-yellow-400' : p >= 50 ? 'bg-orange-500' : 'bg-red-500');

export default function ComplianceBars({ groups, title = 'Department Compliance' }) {
  return (
    <div className="panel p-6 h-full">
      <p className="eyebrow mb-5">{title}</p>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.name}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-700">{g.name} <span className="text-xs text-muted-foreground">· {g.total} eq.</span></span>
              <span className="font-mono font-medium tabular-nums">{g.compliance}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${tone(g.compliance)} transition-all duration-1000`} style={{ width: `${g.compliance}%` }} />
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
      </div>
    </div>
  );
}