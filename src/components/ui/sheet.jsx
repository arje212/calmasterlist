import React, { createContext, useContext, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useModal } from '@/hooks/useModal';

const SheetContext = createContext(null);

function SheetShell({ onOpenChange, children }) {
  const ref = useRef(null);
  useModal(true, onOpenChange, ref);
  return (
    <SheetContext.Provider value={{ ref, onOpenChange }}>
      <div className="fixed inset-0 z-50">
        <button type="button" tabIndex={-1} aria-hidden="true" className="fixed inset-0 cursor-default bg-black/50" onClick={() => onOpenChange?.(false)} />
        {children}
      </div>
    </SheetContext.Provider>
  );
}

export function Sheet({ open, onOpenChange, children }) {
  if (!open) return null;
  return <SheetShell onOpenChange={onOpenChange}>{children}</SheetShell>;
}
export function SheetContent({ side = 'right', className, children, label = 'Navigation menu' }) {
  const ctx = useContext(SheetContext);
  return (
    <div ref={ctx?.ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
      className={cn('fixed inset-y-0 z-50 flex w-3/4 max-w-sm flex-col bg-background shadow-lg focus:outline-none', side === 'left' ? 'left-0' : 'right-0', className)}>
      {children}
      <button type="button" aria-label="Close menu" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-md text-2xl leading-none text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" onClick={() => ctx?.onOpenChange?.(false)}>×</button>
    </div>
  );
}
