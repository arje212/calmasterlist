import React, { cloneElement, useId, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_META, REPORT_STATUS_META } from '@/lib/calibration';
import { EMPTY_FILTERS } from '@/lib/masterlistFilter';

function Field({ label, children }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-600">{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}

function F({ id, value, onChange, placeholder, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-10 bg-white text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
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
  const moreCount = (filters.control ? 1 : 0) + (filters.location !== 'all' ? 1 : 0) + (filters.type !== 'all' ? 1 : 0);
  const [showMore, setShowMore] = useState(moreCount > 0);

  // Status / report are not dropdowns, but Dashboard links set them (?status=...&report=...).
  // Show them as removable chips so the person can see why the list is filtered.
  const chips = [];
  if (filters.status !== 'all') chips.push({ key: 'status', label: `Status: ${STATUS_META[filters.status]?.label || filters.status}` });
  if (filters.report !== 'all') chips.push({ key: 'report', label: `Report: ${filters.report === 'pending' ? 'Pending (not approved)' : REPORT_STATUS_META[filters.report]?.label || filters.report}` });

  return (
    <div className="panel p-4 space-y-3" role="search" aria-label="Filter equipment">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" aria-hidden="true" />
        <Input type="search" aria-label="Search equipment" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, name, serial, asset no., manufacturer, model, department, location…" className="pl-9 h-11 bg-slate-50/60" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Equipment type">
          <F value={filters.etype} onChange={set('etype')} placeholder="All types" options={toOpts(equipmentTypes)} />
        </Field>
        <Field label="Due from">
          <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set('from')(e.target.value)} className="h-10 text-sm bg-white" />
        </Field>
        <Field label="Due to">
          <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set('to')(e.target.value)} className="h-10 text-sm bg-white" />
        </Field>
      </div>
      <div>
        <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} aria-controls="more-filters"
          className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} aria-hidden="true" />
          More filters{moreCount > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-white">{moreCount}</span>}
        </button>
        {showMore && (
          <div id="more-filters" className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Control #">
              <Input value={filters.control} onChange={(e) => set('control')(e.target.value)} placeholder="e.g. C0041ME" className="h-10 text-sm bg-white" />
            </Field>
            <Field label="Location">
              <F value={filters.location} onChange={set('location')} placeholder="All locations" options={toOpts(locations)} />
            </Field>
            <Field label="Checking type">
              <F value={filters.type} onChange={set('type')} placeholder="All checking types" options={toOpts(checkingTypes)} />
            </Field>
          </div>
        )}
      </div>
      {(active || chips.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Button key={c.key} variant="secondary" size="sm" className="h-9 text-sm gap-1" onClick={() => set(c.key)('all')} aria-label={`Remove filter ${c.label}`}>
              {c.label} <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ))}
          {active && (
            <Button variant="ghost" size="sm" className="h-9 text-sm gap-1 text-muted-foreground" onClick={() => { setSearch(''); setFilters(EMPTY_FILTERS); }}>
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
