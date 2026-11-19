import React, { useCallback, useRef, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// Replacement for window.confirm. Usage:
//   const { confirm, confirmDialog } = useConfirm();
//   if (!(await confirm({ title: 'Delete draft?', description: '...', confirmLabel: 'Delete', destructive: true }))) return;
//   ...render {confirmDialog} once in the component's JSX.
export function useConfirm() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);
  const settle = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);
  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setState(typeof options === 'string' ? { title: options } : options);
  }), []);
  const confirmDialog = (
    <AlertDialog open={!!state} onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          {state?.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>{state?.cancelLabel || 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)} className={state?.destructive ? 'bg-red-600 hover:bg-red-700' : ''}>{state?.confirmLabel || 'Continue'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { confirm, confirmDialog };
}
