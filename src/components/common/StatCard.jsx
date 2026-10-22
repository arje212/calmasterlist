import React from 'react';
import { Link } from 'react-router-dom';

export default function StatCard({ label, value, hint, accent = 'bg-primary', icon: Icon, to }) {
  const body = (
    <div className="panel p-5 h-full relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <span className={`absolute left-0 top-5 bottom-5 w-[3px] rounded-r ${accent}`} />
      <div className="flex items-start justify-between">
        <p className="eyebrow">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}