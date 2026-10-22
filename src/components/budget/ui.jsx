// src/components/budget/ui.jsx
// Maliliit na UI piraso na gamit ng Dashboard section at ng Budget Entry page
import React from 'react';

export const cn = (...a) => a.filter(Boolean).join(' ');

export const money = (n, d = 2) =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (n) => (n == null || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(1)}%`);

export function Card({ className, children }) {
  return (
    <section className={cn('rounded-2xl border border-[#e7e3f7] bg-white p-6 shadow-[0_4px_18px_rgba(90,60,200,.07)]', className)}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-[17px] font-bold text-[#1b1740]">{title}</h3>
        {subtitle && <p className="mt-1 text-[13px] text-[#5b5675]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Kpi({ label, value, hint, dot = '#7c5cfc' }) {
  return (
    <div className="rounded-2xl border border-[#e7e3f7] bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[#5b5675]">
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
        {label}
      </div>
      <div className="mt-2.5 text-[26px] font-extrabold tracking-tight text-[#1b1740]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[#5b5675]">{hint}</div>}
    </div>
  );
}

const TONES = {
  purple: 'bg-[#ede9fe] text-[#5b21b6]',
  green: 'bg-[#d1fae5] text-[#065f46]',
  amber: 'bg-[#fef3c7] text-[#92400e]',
  red: 'bg-[#fee2e2] text-[#991b1b]',
  orange: 'bg-[#ffedd5] text-[#9a3412]',
  yellow: 'bg-[#fef9c3] text-[#854d0e]',
  blue: 'bg-[#dbeafe] text-[#1e40af]',
};
export function Chip({ tone = 'purple', children, className }) {
  return <span className={cn('inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', TONES[tone], className)}>{children}</span>;
}

export function Stat({ label, value, hint }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#5b5675]">{label}</div>
      <div className="mt-1.5 text-xl font-extrabold text-[#1b1740]">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[#5b5675]">{hint}</div>}
    </div>
  );
}
