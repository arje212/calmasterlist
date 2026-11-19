import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const MenuContext = createContext(null);

export function DropdownMenu({ children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const close = (returnFocus = true) => { setOpen(false); if (returnFocus) triggerRef.current?.focus(); };
  return (
    <MenuContext.Provider value={{ open, setOpen, close, triggerRef, menuId }}>
      <div ref={rootRef} className="relative inline-block">{children}</div>
    </MenuContext.Provider>
  );
}

export function DropdownMenuTrigger({ children }) {
  const { open, setOpen, triggerRef, menuId } = useContext(MenuContext);
  return React.cloneElement(children, {
    ref: triggerRef,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: (event) => { children.props.onClick?.(event); setOpen(!open); },
    onKeyDown: (event) => { children.props.onKeyDown?.(event); if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } },
  });
}

export function DropdownMenuContent({ className, align = 'end', children }) {
  const { open, close, menuId } = useContext(MenuContext);
  const ref = useRef(null);
  useEffect(() => { if (open) ref.current?.querySelector('[role="menuitem"]')?.focus(); }, [open]);
  if (!open) return null;
  const onKeyDown = (event) => {
    const items = [...ref.current.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    const go = (i) => { event.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    if (event.key === 'ArrowDown') go(index + 1);
    else if (event.key === 'ArrowUp') go(index - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(items.length - 1);
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') close(false);
  };
  return <div ref={ref} id={menuId} role="menu" onKeyDown={onKeyDown} className={cn('absolute z-50 mt-2 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md', align === 'start' ? 'left-0' : 'right-0', className)}>{children}</div>;
}

export function DropdownMenuItem({ className, onClick, children }) {
  const { close } = useContext(MenuContext);
  return <button type="button" role="menuitem" tabIndex={-1} className={cn('flex min-h-10 w-full items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none', className)} onClick={(event) => { onClick?.(event); close(); }}>{children}</button>;
}
