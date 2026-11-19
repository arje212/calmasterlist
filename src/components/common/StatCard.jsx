import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

// Cards with a `to` link show an arrow, so clickable and read-only cards are easy to tell apart.
export default function StatCard({ label, value, hint, accent = 'bg-primary', icon: Icon, to }) {
  const body = (
    <div className={`panel p-5 h-full relative overflow-hidden group transition-all duration-300 ${to ? 'hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40' : ''}`}>
      <span className={`absolute left-0 top-5 bottom-5 w-[3px] rounded-r ${accent}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {to ? <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-primary transition-colors" aria-hidden="true" />
          : Icon && <Icon className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return to ? <Link to={to} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link> : body;
}
