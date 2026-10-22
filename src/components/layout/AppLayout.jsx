import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Gauge, ShieldOff } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';
import { useMe, useNotifications } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';
import SidebarNav from '@/components/layout/SidebarNav';
import LoadingState from '@/components/common/LoadingState';

export default function AppLayout() {
  const { data: me, isLoading } = useMe();
  const { unread } = useNotifications();
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
        <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /><span className="font-semibold text-sm">CalibraTrack</span></div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-72 border-0">{nav}</SheetContent>
      </Sheet>
      <main className="lg:pl-64">
        <div key={location.pathname} className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}