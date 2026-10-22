import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_META, REPORT_STATUS_META } from '@/lib/calibration';
import { EMPTY_FILTERS } from '@/lib/masterlistFilter';

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function F({ value, onChange, placeholder, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 bg-white text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function MasterlistFilters({ search, setSearch, filters, setFilters, equipmentTypes = [], locations = [], checkingTypes = [] }) {
  const set = (k) => (v) => setFilters({ ...filters, [k]: v });
  const active = search || JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const toOpts = (list) => list.map((v) => ({ value: v, label: v }));

  // Status / report are no longer dropdowns, but Dashboard links still set them (?status=...&report=...).
  // Show them as removable chips so the person can see why the list is filtered.
  const chips = [];
  if (filters.status !== 'all') chips.push({ key: 'status', label: `Status: ${STATUS_META[filters.status]?.label || filters.status}` });
  if (filters.report !== 'all') chips.push({ key: 'report', label: `Report: ${filters.report === 'pending' ? 'Pending (not approved)' : REPORT_STATUS_META[filters.report]?.label || filters.report}` });

  return (
    <div className="panel p-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, name, serial, asset no., manufacturer, model, department, location…" className="pl-9 h-10 bg-slate-50/60" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Field label="Control #">
          <Input value={filters.control} onChange={(e) => set('control')(e.target.value)} placeholder="e.g. C0041ME" className="h-9 text-xs bg-white" />
        </Field>
        <Field label="Equipment type">
          <F value={filters.etype} onChange={set('etype')} placeholder="All types" options={toOpts(equipmentTypes)} />
        </Field>
        <Field label="Location">
          <F value={filters.location} onChange={set('location')} placeholder="All locations" options={toOpts(locations)} />
        </Field>
        <Field label="Checking type">
          <F value={filters.type} onChange={set('type')} placeholder="All checking types" options={toOpts(checkingTypes)} />
        </Field>
        <Field label="Checking Date">
          <Input type="date" value={filters.from} onChange={(e) => set('from')(e.target.value)} className="h-9 text-xs bg-white" />
        </Field>
        <Field label="Checking due">
          <Input type="date" value={filters.to} onChange={(e) => set('to')(e.target.value)} className="h-9 text-xs bg-white" />
        </Field>
      </div>
      {(active || chips.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Button key={c.key} variant="secondary" size="sm" className="h-7 text-xs gap-1" onClick={() => set(c.key)('all')}>
              {c.label} <X className="h-3 w-3" />
            </Button>
          ))}
          {active && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => { setSearch(''); setFilters(EMPTY_FILTERS); }}>
              <X className="h-3 w-3" /> Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}