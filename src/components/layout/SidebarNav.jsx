import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, ListChecks, CalendarDays, FileText, BarChart3, Bell, ScrollText, Users, Settings, LogOut, Gauge, Ruler, KeyRound, Truck, ClipboardList, PiggyBank, BookOpen, ClipboardCheck } from 'lucide-react';

// Grouped so the 15 destinations scan as a few clusters instead of one long list.
const GROUPS = [
  { label: 'Monitor', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  ] },
  { label: 'Equipment', items: [
    { to: '/masterlist', label: 'Calibration Masterlist', icon: ListChecks },
    { to: '/external-calibrations', label: 'External Calibration', icon: Truck },
    { to: '/standard-masterlist', label: 'Standard Masterlist', icon: Ruler },
  ] },
  { label: 'Work', items: [
    { to: '/tasks', label: 'Tasks', icon: ClipboardList },
    { to: '/reports', label: 'Reports', icon: FileText },
  ] },
  { label: 'Documents', items: [
    { to: '/procedures', label: 'Procedures', icon: BookOpen },
    { to: '/process-instructions', label: 'Process Instructions', icon: ClipboardCheck },
  ] },
  { label: 'Planning', items: [
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/budget', label: 'Budget Entry', icon: PiggyBank },
  ] },
  { label: 'Administration', admin: true, items: [
    { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/settings', label: 'Settings', icon: Settings },
  ] },
];

const linkCls = ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${isActive ? 'bg-sidebar-accent text-white shadow-inner' : 'hover:bg-sidebar-accent/60 hover:text-white'}`;

export default function SidebarNav({ me, unread, onNavigate, onLogout }) {
  const isAdmin = me?.role === 'admin';
  const roleName = { admin: 'Admin', sr_staff: 'Sr. Staff', qa_manager: 'QA Manager', user: 'Staff / Inspector' }[me?.role] || 'Staff / Inspector';
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center"><Gauge className="h-4 w-4 text-white" aria-hidden="true" /></div>
        <div className="leading-tight">
          <p className="text-white font-semibold text-sm tracking-tight">QA</p>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Nikkoshi System</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto scrollbar-hidden px-3 pb-5">
        {GROUPS.filter((g) => !g.admin || isAdmin).map((g) => (
          <div key={g.label} role="group" aria-label={g.label} className="pt-5">
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400" aria-hidden="true">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} className={linkCls}>
                  <n.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{n.label}</span>
                  {n.badge && unread > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
                      {unread}<span className="sr-only"> unread</span>
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-sidebar-accent flex items-center justify-center text-white text-sm font-semibold" aria-hidden="true">{(me?.full_name || me?.email || '?')[0].toUpperCase()}</div>
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{me?.full_name || me?.email}</p>
            <p className="text-xs uppercase tracking-[0.12em] text-sky-300 font-semibold">{roleName}</p>
          </div>
        </div>
        <Link to="/reset-password" onClick={onNavigate} className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-sidebar-accent/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <KeyRound className="h-4 w-4" aria-hidden="true" /> Change password
        </Link>
        <button type="button" onClick={onLogout} className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-sidebar-accent/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
        </button>
      </div>
    </div>
  );
}
