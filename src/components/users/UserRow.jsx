import React from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Activity, KeyRound, Ban, CheckCircle2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function UserRow({ u, isSelf, activityCount, onRole, onToggle, onReset, onActivity, onEdit }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 px-5 py-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">{(u.full_name || u.email)[0].toUpperCase()}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{u.full_name || '—'} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}</p>
          <p className="text-xs text-muted-foreground truncate">{u.email} · joined {format(new Date(u.created_date), 'MMM d, yyyy')}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${u.disabled ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{u.disabled ? 'Disabled' : 'Active'}</span>
        <span className="text-xs text-muted-foreground w-20 tabular-nums">{activityCount} actions</span>
        <Select value={u.role} onValueChange={onRole} disabled={isSelf}>
          <SelectTrigger className="w-36 h-9 text-xs" aria-label={`Role for ${u.full_name || u.email}`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="user">STAFF / INSPECTOR</SelectItem><SelectItem value="sr_staff">SR. STAFF</SelectItem><SelectItem value="qa_manager">QA MANAGER</SelectItem><SelectItem value="admin">ADMIN</SelectItem></SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 md:h-9 md:w-9" aria-label={`Actions for ${u.full_name || u.email}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Edit report identity</DropdownMenuItem>
            <DropdownMenuItem onClick={onActivity}><Activity className="h-4 w-4 mr-2" />View activity</DropdownMenuItem>
            <DropdownMenuItem onClick={onReset}><KeyRound className="h-4 w-4 mr-2" />Set temporary password</DropdownMenuItem>
            {!isSelf && <DropdownMenuItem onClick={onToggle} className={u.disabled ? '' : 'text-red-600'}>{u.disabled ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Ban className="h-4 w-4 mr-2" />}{u.disabled ? 'Enable user' : 'Disable user'}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}