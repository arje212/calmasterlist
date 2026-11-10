import React, { useEffect, useMemo, useState } from 'react';

const tone = (p) => (p >= 90 ? 'bg-emerald-500' : p >= 75 ? 'bg-yellow-400' : p >= 50 ? 'bg-orange-500' : 'bg-red-500');

// sortByCompliance: lowest first, so the departments that need attention are at the top.
export default function ComplianceBars({ groups, title = 'Department Compliance', sortByCompliance = true }) {
  const [ready, setReady] = useState(false);

  // Bars mount at 0 width, then grow on the next tick so the CSS transition has something to animate.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  const rows = useMemo(
    () => (sortByCompliance ? [...groups].sort((a, b) => a.compliance - b.compliance) : groups),
    [groups, sortByCompliance]
  );

  return (
    <div className="panel p-6 h-full">
      <p className="eyebrow mb-5">{title}</p>
      <div className="space-y-4">
        {rows.map((g, i) => (
          <div key={g.name}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-700">
                {g.name} <span className="text-xs text-muted-foreground">· {g.total} eq.</span>
              </span>
              <span className="font-mono font-medium tabular-nums">{g.compliance}%</span>
            </div>
            <div
              className="h-2 rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-label={`${g.name} compliance`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={g.compliance}
            >
              <div
                className={`h-full rounded-full ${tone(g.compliance)} transition-[width] duration-700 ease-out motion-reduce:transition-none`}
                style={{ width: `${ready ? g.compliance : 0}%`, transitionDelay: `${i * 70}ms` }}
              />
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
      </div>
    </div>
  );
}