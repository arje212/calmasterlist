import React from 'react';
import { cn } from '@/lib/utils';
export function Dialog({ open, onOpenChange, children }) { if (!open) return null; return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="Close dialog" className="fixed inset-0 bg-black/50" onClick={() => onOpenChange?.(false)} />{React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child, { onOpenChange }) : child)}</div>; }
export function DialogContent({ className, children }) { return <div className={cn('relative z-10 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg', className)}>{children}</div>; }
export const DialogHeader = ({ className, ...props }) => <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />;
export const DialogTitle = ({ className, ...props }) => <h2 className={cn('text-lg font-semibold', className)} {...props} />;
export const DialogDescription = ({ className, ...props }) => <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
export const DialogFooter = ({ className, ...props }) => <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6', className)} {...props} />;
