import React from 'react';

export default function ComplianceCard({ pct, onTime, due }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = pct >= 90 ? '#10b981' : pct >= 75 ? '#eab308' : pct >= 50 ? '#f97316' : '#ef4444';
  return (
    <div className="panel p-6 h-full bg-gradient-to-br from-slate-900 to-blue-950 text-white border-0 flex items-center gap-6">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center"><span className="text-3xl font-semibold tabular-nums">{pct}<span className="text-lg opacity-60">%</span></span></div>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-blue-200/70 font-semibold">Calibration Compliance</p>
        <p className="text-sm text-blue-100/80 mt-2 leading-relaxed">{onTime} of {due} due verification cycles in the last 12 months were completed on time.</p>
        <p className="text-[11px] text-blue-200/50 mt-2 font-mono">On-time ÷ Due × 100</p>
      </div>
    </div>
  );
}