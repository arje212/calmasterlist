import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ListChecks, CalendarDays, FileText, BarChart3, Bell, ScrollText, Users, Settings, LogOut, Gauge, Ruler, KeyRound, Truck } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/masterlist', label: 'Calibration Masterlist', icon: ListChecks },
  { to: '/external-calibrations', label: 'External Calibration', icon: Truck },
  { to: '/standard-masterlist', label: 'Standard Masterlist', icon: Ruler },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  { to: '/reset-password', label: 'Change Password', icon: KeyRound },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, admin: true },
  { to: '/users', label: 'Users', icon: Users, admin: true },
  { to: '/settings', label: 'Settings', icon: Settings, admin: true },
];

export default function SidebarNav({ me, unread, onNavigate, onLogout }) {
  const isAdmin = me?.role === 'admin';
  const roleName = { admin: 'Admin', sr_staff: 'Sr. Staff', qa_manager: 'QA Manager', user: 'Staff / Inspector' }[me?.role] || 'Staff / Inspector';
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center"><Gauge className="h-4 w-4 text-white" /></div>
        <div className="leading-tight">
          <p className="text-white font-semibold text-sm tracking-tight">QA/QC</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Nikkoshi System</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-hidden px-3 py-5 space-y-0.5">
        {NAV.filter((n) => !n.admin || isAdmin).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${isActive ? 'bg-sidebar-accent text-white shadow-inner' : 'hover:bg-sidebar-accent/60 hover:text-white'}`}>
            <n.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{n.label}</span>
            {n.admin && <span className="text-[9px] uppercase tracking-wider text-slate-500">Admin</span>}
            {n.badge && unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">{unread}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center text-white text-sm font-semibold">{(me?.full_name || me?.email || '?')[0].toUpperCase()}</div>
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{me?.full_name || me?.email}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-sidebar-primary font-semibold">{roleName}</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] hover:bg-sidebar-accent/60 hover:text-white transition-colors">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );
}