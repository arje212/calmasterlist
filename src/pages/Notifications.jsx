import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck, OctagonAlert, Timer, Hourglass, FileWarning, XCircle, CheckCircle2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useCalData';
import { markRead } from '@/lib/notifications';
import { toDate } from '@/lib/calibration';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';

const TYPES = {
  expired: { icon: OctagonAlert, tone: 'text-red-600 bg-red-50', label: 'Expired' },
  due_soon: { icon: Timer, tone: 'text-orange-600 bg-orange-50', label: 'Due soon' },
  near: { icon: Hourglass, tone: 'text-yellow-700 bg-yellow-50', label: 'Expiring' },
  pending: { icon: FileWarning, tone: 'text-red-600 bg-red-50', label: 'Pending reports' },
  action: { icon: ClipboardList, tone: 'text-blue-600 bg-blue-50', label: 'Needs review' },
  rejected: { icon: XCircle, tone: 'text-red-600 bg-red-50', label: 'Rejected' },
  approved: { icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50', label: 'Approved' },
};

export default function Notifications() {
  const { items, readIds, unread, isLoading } = useNotifications();
  const [filter, setFilter] = useState('all');
  if (isLoading) return <LoadingState />;
  const counts = Object.fromEntries(Object.keys(TYPES).map((t) => [t, items.filter((i) => i.type === t).length]));
  const shown = items.filter((i) => filter === 'all' || i.type === filter);

  return (
    <div>
      <PageHeader eyebrow="Inbox" title="Notifications" description={`${unread} unread`}>
        <Button variant="outline" className="gap-2" disabled={!unread} onClick={() => markRead(items.map((i) => i.id))}><CheckCheck className="h-4 w-4" />Mark all as read</Button>
      </PageHeader>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${filter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'}`}>All {items.length}</button>
        {Object.entries(TYPES).filter(([t]) => counts[t]).map(([t, m]) => (
          <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${filter === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'}`}>{m.label} {counts[t]}</button>
        ))}
      </div>
      {shown.length === 0 ? <div className="panel"><EmptyState icon={Bell} title="You're all caught up" /></div> : (
        <div className="panel divide-y fade-up">
          {shown.map((n) => {
            const m = TYPES[n.type];
            const read = readIds.has(n.id);
            return (
              <Link key={n.id} to={n.link} onClick={() => markRead([n.id])} className={`flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${read ? 'opacity-60' : ''}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${m.tone}`}><m.icon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {toDate(n.date) && <span className="text-[11px] text-muted-foreground hidden sm:inline">{formatDistanceToNow(toDate(n.date), { addSuffix: true })}</span>}
                  {!read && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}