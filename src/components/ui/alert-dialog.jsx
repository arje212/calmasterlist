import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';
export { DialogHeader as AlertDialogHeader, DialogTitle as AlertDialogTitle, DialogDescription as AlertDialogDescription, DialogFooter as AlertDialogFooter } from './dialog';
export function AlertDialog({ open, onOpenChange, children }) { return <Dialog open={open} onOpenChange={onOpenChange}>{children}</Dialog>; }
export const AlertDialogContent = DialogContent;
export const AlertDialogAction = ({ className = '', ...props }) => <button className={`inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 ${className}`} {...props} />;
export const AlertDialogCancel = ({ className = '', ...props }) => <button className={`mt-2 inline-flex h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent sm:mt-0 ${className}`} {...props} />;
