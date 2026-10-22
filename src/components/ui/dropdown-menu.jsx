import React, { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';
const MenuContext = createContext(null);
export function DropdownMenu({ children }) { const [open, setOpen] = useState(false); return <MenuContext.Provider value={{ open, setOpen }}>{children}</MenuContext.Provider>; }
export function DropdownMenuTrigger({ asChild, children }) { const { open, setOpen } = useContext(MenuContext); return React.cloneElement(children, { onClick: (event) => { children.props.onClick?.(event); setOpen(!open); } }); }
export function DropdownMenuContent({ className, children }) { const { open } = useContext(MenuContext); if (!open) return null; return <div className={cn('absolute right-0 z-50 mt-2 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md', className)}>{children}</div>; }
export function DropdownMenuItem({ className, onClick, children }) { const { setOpen } = useContext(MenuContext); return <button type="button" className={cn('flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent', className)} onClick={(event) => { onClick?.(event); setOpen(false); }}>{children}</button>; }
