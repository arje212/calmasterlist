import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { usePrefersReducedMotion } from '@/hooks/useMotion';

const SERIES = [
  { key: 'verified', name: 'Verified', fill: '#1d4ed8' },
  { key: 'passed', name: 'Passed', fill: '#10b926' },
  { key: 'failed', name: 'Failed', fill: '#ef4444' },
];

export default function TrendChart({ data, title = 'Monthly Verification Trend' }) {
  const reduced = usePrefersReducedMotion();
  const hasData = (data || []).some((d) => d.verified || d.passed || d.failed);

  return (
    <div className="panel p-6 h-full">
      <p className="eyebrow mb-4">{title}</p>
      <div className="h-64">
        {!hasData ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No verifications recorded yet.
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.name}
                  fill={s.fill}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!reduced}
                  animationBegin={i * 120}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}