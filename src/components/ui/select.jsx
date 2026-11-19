import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const SelectContext = createContext(null);
const textOf = (node) => React.Children.toArray(node).map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : React.isValidElement(c) ? textOf(c.props.children) : '')).join('');

export function Select({ value, defaultValue, onValueChange, disabled = false, children }) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue || '');
  const [labels, setLabels] = useState({});
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listId = useId();
  const selected = value ?? internal;
  const register = useCallback((v, label) => setLabels((prev) => (prev[v] === label ? prev : { ...prev, [v]: label })), []);
  const close = useCallback((returnFocus = true) => { setOpen(false); if (returnFocus) triggerRef.current?.focus(); }, []);
  const change = (next) => { setInternal(next); onValueChange?.(next); close(); };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <SelectContext.Provider value={{ selected, labels, register, open, setOpen, close, change, disabled, triggerRef, listId }}>
      <div ref={rootRef} className="contents">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className, children, onKeyDown, ...props }) {
  const { open, setOpen, disabled, triggerRef, listId } = useContext(SelectContext);
  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); }
  };
  return (
    <button {...props} ref={triggerRef} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled}
      onClick={() => !disabled && setOpen(!open)} onKeyDown={handleKeyDown}
      className={cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)}>
      <span className="truncate">{children}</span><span className="ml-2 text-muted-foreground" aria-hidden="true">⌄</span>
    </button>
  );
}

// Shows the item's label (not its raw value), so a value like "all" displays as "All types".
export function SelectValue({ placeholder = '' }) {
  const { selected, labels } = useContext(SelectContext);
  return labels[selected] ?? (selected || placeholder);
}

export function SelectContent({ className, children }) {
  const { open, close, listId, selected } = useContext(SelectContext);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const target = ref.current?.querySelector('[role="option"][aria-selected="true"]') || ref.current?.querySelector('[role="option"]');
    target?.focus();
    target?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);
  const onKeyDown = (event) => {
    const items = [...ref.current.querySelectorAll('[role="option"]')];
    const index = items.indexOf(document.activeElement);
    const go = (i) => { event.preventDefault(); items[Math.max(0, Math.min(items.length - 1, i))]?.focus(); };
    if (event.key === 'ArrowDown') go(index + 1);
    else if (event.key === 'ArrowUp') go(index - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(items.length - 1);
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') close(false);
  };
  // Always mounted (hidden when closed) so every item can register its label for SelectValue.
  return <div ref={ref} id={listId} role="listbox" hidden={!open} onKeyDown={onKeyDown} className={cn('absolute z-50 mt-1 max-h-60 min-w-[8rem] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md', className)}>{children}</div>;
}

export function SelectItem({ value, children, className }) {
  const { selected, change, register } = useContext(SelectContext);
  const label = textOf(children);
  useEffect(() => { register(value, label); }, [value, label, register]);
  return (
    <button type="button" role="option" aria-selected={selected === value} tabIndex={-1} onClick={() => change(value)}
      className={cn('relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground', selected === value && 'bg-accent font-medium', className)}>{children}</button>
  );
}
