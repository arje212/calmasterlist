import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';

export default function ForecastChart({ equipment }) {
  const within = (d) => equipment.filter((e) => e.days_left !== null && e.days_left >= 0 && e.days_left <= d).length;
  const data = [
    { name: 'Within 7 days', value: within(7), color: '#f97316' },
    { name: 'Within 30 days', value: within(30), color: '#eab308' },
    { name: 'Within 60 days', value: within(60), color: '#3b82f6' },
    { name: 'Within 90 days', value: within(90), color: '#1e40af' },
  ];
  return (
    <div className="panel p-6 h-full">
      <p className="eyebrow mb-4">Expiration Forecast</p>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis hide allowDecimals={false} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" name="Equipment" radius={[6, 6, 0, 0]}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 600, fill: '#0f172a' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}