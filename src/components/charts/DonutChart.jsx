import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// data: [{ name, value, color }]
export default function DonutChart({ title, data, centerLabel }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="panel p-6 h-full">
      <p className="eyebrow mb-4">{title}</p>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={total ? data : [{ name: 'None', value: 1, color: '#e2e8f0' }]} dataKey="value" innerRadius={56} outerRadius={80} paddingAngle={total ? 2 : 0} stroke="none" animationDuration={900}>
                {(total ? data : [{ color: '#e2e8f0' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              {total > 0 && <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} />}
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-2xl font-semibold tabular-nums">{total}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{centerLabel}</p>
          </div>
        </div>
        <div className="flex-1 w-full space-y-2.5">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} /><span className="text-slate-700">{d.name}</span></div>
              <span className="tabular-nums font-medium">{d.value} <span className="text-muted-foreground text-xs font-normal ml-1">{total ? Math.round((d.value / total) * 100) : 0}%</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}