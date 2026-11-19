import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useCountUp, usePrefersReducedMotion } from '@/hooks/useMotion';

// data: [{ name, value, color }]
// onSelect (optional): called with the data item when a slice or legend row is clicked
export default function DonutChart({ title, data, centerLabel, onSelect }) {
  const [hover, setHover] = useState(null); // hovered item name
  const reduced = usePrefersReducedMotion();
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = useCountUp(total);

  // Zero-value slices add padding gaps but no visible arc, so leave them out of the ring.
  const slices = data.filter((d) => d.value > 0);
  const ring = total ? slices : [{ name: 'None', value: 1, color: '#e2e8f0' }];
  const dim = (name) => (hover && hover !== name ? 0.3 : 1);

  return (
    <div className="panel p-6 h-full">
      <p className="eyebrow mb-4">{title}</p>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={ring}
                dataKey="value"
                innerRadius={56}
                outerRadius={80}
                paddingAngle={total ? 2 : 0}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={!reduced}
                animationDuration={900}
                animationEasing="ease-out"
                onMouseEnter={total ? (entry) => setHover(entry.name) : undefined}
                onMouseLeave={() => setHover(null)}
                onClick={total && onSelect ? (entry) => onSelect(data.find((d) => d.name === entry.name)) : undefined}
                style={{ cursor: total && onSelect ? 'pointer' : 'default', outline: 'none' }}
              >
                {ring.map((d) => (
                  <Cell key={d.name} fill={d.color} style={{ opacity: total ? dim(d.name) : 1, transition: 'opacity 150ms ease-out' }} />
                ))}
              </Pie>
              {total > 0 && <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} />}
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-2xl font-semibold tabular-nums">{shown}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{centerLabel}</p>
          </div>
        </div>

        <div className="flex-1 w-full space-y-1">
          {data.map((d) => {
            const interactive = onSelect
              ? { role: 'button', tabIndex: 0, onClick: () => onSelect(d), onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(d)) }
              : {};
            return (
              <div
                key={d.name}
                {...interactive}
                onMouseEnter={() => d.value > 0 && setHover(d.name)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => d.value > 0 && setHover(d.name)}
                onBlur={() => setHover(null)}
                className={`flex items-center justify-between text-sm rounded-md px-2 py-1.5 -mx-2 transition-colors duration-150 ${
                  hover === d.name ? 'bg-slate-100' : ''
                } ${d.value === 0 ? 'opacity-50' : ''} ${onSelect ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                  <span className="text-slate-700">{d.name}</span>
                </div>
                <span className="tabular-nums font-medium">
                  {d.value}
                  <span className="text-muted-foreground text-xs font-normal ml-1">{total ? Math.round((d.value / total) * 100) : 0}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}