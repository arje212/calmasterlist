import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Gauge, ShieldOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';
import { useMe, useNotifications } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';
import { desktopNotificationsEnabled, showDesktopNotification } from '@/lib/desktopNotifications';
import SidebarNav from '@/components/layout/SidebarNav';
import LoadingState from '@/components/common/LoadingState';
import Assistant from '@/pages/Assistant';

export default function AppLayout() {
  const { data: me, isLoading } = useMe();
  const { unread } = useNotifications();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!me) return;
    const key = `cal_login_${me.id}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      logAudit(me, { action: 'login', entity_type: 'Session', entity_label: me.email });
    }
  }, [me]);

  useEffect(() => {
    if (!me?.id) return undefined;
    const controller = new AbortController();
    let retryTimer;
    let stableTimer;
    let retryDelay = 1000;
    const waitToRetry = () => new Promise((resolve) => {
      const finish = () => {
        clearTimeout(retryTimer);
        controller.signal.removeEventListener('abort', finish);
        resolve();
      };
      retryTimer = setTimeout(finish, retryDelay);
      controller.signal.addEventListener('abort', finish, { once: true });
    });
    const connect = async () => {
      while (!controller.signal.aborted) {
        try {
          await apiClient.notifications.stream({
            signal: controller.signal,
            onReady: () => {
              clearTimeout(stableTimer);
              stableTimer = setTimeout(() => { retryDelay = 1000; }, 30000);
              queryClient.invalidateQueries({ queryKey: ['notifications', me.id] });
            },
            onNotification: (notification) => {
              queryClient.invalidateQueries({ queryKey: ['notifications', me.id] });
              if (document.visibilityState === 'hidden' && desktopNotificationsEnabled(me.id)) {
                try {
                  showDesktopNotification(me.id, notification);
                } catch (error) {
                  console.error('Could not display desktop notification:', error);
                }
              }
            },
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          console.error('Notification stream disconnected:', error);
        }
        if (controller.signal.aborted) return;
        clearTimeout(stableTimer);
        await waitToRetry();
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    };
    connect();
    return () => {
      controller.abort();
      clearTimeout(retryTimer);
      clearTimeout(stableTimer);
    };
  }, [me?.id, queryClient]);

  const logout = async () => {
    try {
      await logAudit(me, { action: 'logout', entity_type: 'Session', entity_label: me?.email });
    } catch {
      // Logging must not block logout.
    } finally {
      sessionStorage.removeItem(`cal_login_${me?.id}`);
      apiClient.auth.logout('/login');
    }
  };

  if (isLoading) return <LoadingState />;
  if (me?.disabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldOff className="h-10 w-10 text-red-500" />
        <h1 className="text-xl font-semibold">Your account has been disabled</h1>
        <p className="text-sm text-muted-foreground">Please contact your administrator.</p>
        <Button variant="outline" onClick={() => apiClient.auth.logout('/login')}>Logout</Button>
      </div>
    );
  }

  const nav = <SidebarNav me={me} unread={unread} onNavigate={() => setOpen(false)} onLogout={logout} />;
  return (
    <div className="min-h-screen">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30 no-print">{nav}</aside>
      <header className="lg:hidden sticky top-0 z-20 h-14 bg-white/90 backdrop-blur border-b flex items-center justify-between px-4 no-print">
        <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /><span className="font-semibold text-sm">QA/QC Nikkoshi System</span></div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-72 border-0">{nav}</SheetContent>
      </Sheet>
      <main className="lg:pl-64">
        <div key={location.pathname} className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          <Suspense fallback={<div className="min-h-[60vh]"><LoadingState label="Loading page…" /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Assistant />
    </div>
  );
}