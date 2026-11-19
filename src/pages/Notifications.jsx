import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck, OctagonAlert, Timer, Hourglass, FileWarning, XCircle, CheckCircle2, ClipboardList } from 'lucide-react';
import { useMe, useNotifications } from '@/hooks/useCalData';
import { toast } from 'sonner';
import {
  desktopNotificationsEnabled,
  desktopNotificationsSupported,
  requestDesktopNotificationPermission,
  setDesktopNotificationsEnabled,
} from '@/lib/desktopNotifications';
import { toDate } from '@/lib/calibration';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';

const TYPES = {
  new_report: { icon: FileWarning, tone: 'text-blue-600 bg-blue-50', label: 'New Report' },
  for_review: { icon: ClipboardList, tone: 'text-blue-600 bg-blue-50', label: 'For Review' },
  manager_approval: { icon: ClipboardList, tone: 'text-violet-600 bg-violet-50', label: 'For Manager Approval' },
  returned: { icon: XCircle, tone: 'text-orange-600 bg-orange-50', label: 'Returned Report' },
  rejected: { icon: XCircle, tone: 'text-red-600 bg-red-50', label: 'Rejected Report' },
  approved: { icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50', label: 'Approved Report' },
  expired: { icon: OctagonAlert, tone: 'text-red-600 bg-red-50', label: 'Expired' },
  due_soon: { icon: Timer, tone: 'text-orange-600 bg-orange-50', label: 'Due soon' },
  near: { icon: Hourglass, tone: 'text-yellow-700 bg-yellow-50', label: 'Expiring' },
  pending: { icon: FileWarning, tone: 'text-red-600 bg-red-50', label: 'Pending reports' },
};

function DesktopNotificationSettings() {
  const { data: me } = useMe();
  const supported = desktopNotificationsSupported();
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState(supported ? window.Notification.permission : 'unsupported');

  React.useEffect(() => {
    if (!me?.id) return;
    setEnabled(desktopNotificationsEnabled(me.id));
    setPermission(supported ? window.Notification.permission : 'unsupported');
  }, [me?.id, supported]);

  React.useEffect(() => {
    if (!supported) return undefined;
    const refresh = () => setPermission(window.Notification.permission);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [supported]);

  const toggle = async () => {
    if (!me?.id) return;
    if (enabled) {
      setDesktopNotificationsEnabled(me.id, false);
      setEnabled(false);
      return;
    }
    try {
      const result = await requestDesktopNotificationPermission();
      setPermission(result);
      if (result === 'granted') {
        setDesktopNotificationsEnabled(me.id, true);
        setEnabled(true);
        toast.success('Desktop notifications enabled on this browser');
      } else if (result === 'denied') {
        toast.error('Notifications are blocked. Allow them in this site’s browser settings.');
      } else if (result === 'unsupported') {
        toast.error('This browser does not support desktop notifications.');
      }
    } catch (error) {
      console.error('Could not request desktop notification permission:', error);
      toast.error('Could not enable desktop notifications.');
    }
  };

  return (
    <section className="panel mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900">Windows desktop notifications</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {permission === 'unsupported'
            ? 'Desktop notifications are not supported by this browser.'
            : permission === 'denied'
              ? 'Permission is blocked. Change this site’s notification permission in your browser settings.'
              : 'Show short report alerts while this app is open in the browser.'}
        </p>
      </div>
      <button
        type="button"
        className={`inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${enabled ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
        disabled={!supported || permission === 'denied'}
        onClick={toggle}
      >
        {enabled ? 'Disable desktop alerts' : permission === 'denied' ? 'Permission blocked' : 'Enable desktop alerts'}
      </button>
    </section>
  );
}

export default function Notifications() {
  const { items, readIds, unread, isLoading, notificationError, refetchNotifications, markNotificationRead, markAllNotificationsRead } = useNotifications();
  const [filter, setFilter] = useState('all');
  if (isLoading) return <LoadingState />;
  const counts = Object.fromEntries(Object.keys(TYPES).map((t) => [t, items.filter((i) => i.type === t).length]));
  const shown = items.filter((i) => filter === 'all' || i.type === filter);
  const markOne = (item) => {
    markNotificationRead(item).catch((error) => {
      console.error('Could not mark notification as read:', error);
      toast.error(error.message || 'Could not mark notification as read');
    });
  };
  const markAll = () => {
    markAllNotificationsRead().catch((error) => {
      console.error('Could not mark notifications as read:', error);
      toast.error(error.message || 'Could not mark notifications as read');
    });
  };

  return (
    <div>
      <PageHeader eyebrow="Inbox" title="Notifications" description={`${unread} unread`}>
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50" disabled={!unread} onClick={markAll}><CheckCheck className="h-4 w-4" />Mark all as read</button>
      </PageHeader>
      {notificationError && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>Could not load saved notifications: {notificationError.message}</span>
          <button type="button" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground" onClick={() => refetchNotifications()}>Retry</button>
        </div>
      )}
      <DesktopNotificationSettings />
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${filter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'}`}>All {items.length}</button>
        {Object.entries(TYPES).filter(([t]) => counts[t]).map(([t, m]) => (
          <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${filter === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'}`}>{m.label} {counts[t]}</button>
        ))}
      </div>
      {shown.length === 0 ? <div className="panel"><EmptyState icon={Bell} title="You're all caught up" /></div> : (
        <div className="panel divide-y fade-up">
          {shown.map((n) => {
            const m = TYPES[n.type] || TYPES.pending;
            const read = readIds.has(n.id);
            return (
              <Link key={n.id} to={n.link} onClick={() => !read && markOne(n)} className={`flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${read ? 'opacity-60' : ''}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${m.tone}`}><m.icon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {toDate(n.date) && <span className="text-xs text-muted-foreground hidden sm:inline">{formatDistanceToNow(toDate(n.date), { addSuffix: true })}</span>}
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