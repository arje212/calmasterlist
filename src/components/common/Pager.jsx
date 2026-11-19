import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const btn = 'h-10 w-10 md:h-9 md:w-9';

// onPageSizeChange is optional: pass it to show a "Rows" selector. Without it the pager looks and works as before.
export default function Pager({ page, pageSize, total, onChange, onPageSizeChange, pageSizeOptions = [15, 25, 50, 100] }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const [draft, setDraft] = useState(String(page));
  useEffect(() => setDraft(String(page)), [page]);
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const commit = () => {
    const n = Math.min(pages, Math.max(1, parseInt(draft, 10) || page));
    setDraft(String(n));
    if (n !== page) onChange(n);
  };
  const sizes = [...new Set([...pageSizeOptions, pageSize])].sort((a, b) => a - b);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 text-sm text-muted-foreground">
      <span className="tabular-nums" aria-live="polite">{from}–{to} of {total}</span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span>Rows</span>
            <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground md:h-9">
              {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className={`${btn} hidden sm:inline-flex`} aria-label="First page" disabled={page <= 1} onClick={() => onChange(1)}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className={btn} aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <label className="flex items-center gap-1.5 px-1 tabular-nums">
            <span className="sr-only">Page number</span>
            <input type="number" inputMode="numeric" min={1} max={pages} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
              className="h-10 w-14 rounded-md border border-input bg-background px-2 text-center text-sm text-foreground md:h-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            <span>/ {pages}</span>
          </label>
          <Button variant="outline" size="icon" className={btn} aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className={`${btn} hidden sm:inline-flex`} aria-label="Last page" disabled={page >= pages} onClick={() => onChange(pages)}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </nav>
  );
}
