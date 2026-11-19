import React, { createContext, useContext, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useModal } from '@/hooks/useModal';

const DialogContext = createContext(null);

function DialogShell({ onOpenChange, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();
  useModal(true, onOpenChange, ref);
  return (
    <DialogContext.Provider value={{ ref, titleId, descId }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" tabIndex={-1} aria-hidden="true" className="fixed inset-0 cursor-default bg-black/50" onClick={() => onOpenChange?.(false)} />
        {children}
      </div>
    </DialogContext.Provider>
  );
}

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return <DialogShell onOpenChange={onOpenChange}>{children}</DialogShell>;
}
export function DialogContent({ className, children }) {
  const ctx = useContext(DialogContext);
  return (
    <div ref={ctx?.ref} role="dialog" aria-modal="true" aria-labelledby={ctx?.titleId} aria-describedby={ctx?.descId} tabIndex={-1}
      className={cn('relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-lg focus:outline-none', className)}>
      {children}
    </div>
  );
}
export const DialogHeader = ({ className, ...props }) => <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />;
export const DialogTitle = ({ className, ...props }) => { const ctx = useContext(DialogContext); return <h2 id={ctx?.titleId} className={cn('text-lg font-semibold', className)} {...props} />; };
export const DialogDescription = ({ className, ...props }) => { const ctx = useContext(DialogContext); return <p id={ctx?.descId} className={cn('text-sm text-muted-foreground', className)} {...props} />; };
export const DialogFooter = ({ className, ...props }) => <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-6', className)} {...props} />;
