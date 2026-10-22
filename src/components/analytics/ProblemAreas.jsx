import React from 'react';

function TopList({ title, items, field, tone }) {
  const top = items.filter((g) => g[field] > 0).sort((a, b) => b[field] - a[field]).slice(0, 5);
  const max = top[0]?.[field] || 1;
  return (
    <div className="panel p-6">
      <p className="eyebrow mb-4">{title}</p>
      {top.length === 0 ? <p className="text-sm text-muted-foreground">No issues 🎉</p> : (
        <div className="space-y-3">
          {top.map((g) => (
            <div key={g.name}>
              <div className="flex justify-between text-sm mb-1"><span className="truncate">{g.name}</span><span className="font-mono font-semibold">{g[field]}</span></div>
              <div className="h-1.5 rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${(g[field] / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProblemAreas({ depts, locations }) {
  const combined = [...depts.map((d) => ({ ...d, name: `${d.name} (Dept)` })), ...locations.map((l) => ({ ...l, name: `${l.name} (Loc)` }))];
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <TopList title="Most Expired Equipment" items={combined} field="expired" tone="bg-red-500" />
      <TopList title="Most Failed Equipment" items={combined} field="failed" tone="bg-rose-700" />
      <TopList title="Most Pending Reports" items={combined} field="pending" tone="bg-orange-500" />
    </div>
  );
}