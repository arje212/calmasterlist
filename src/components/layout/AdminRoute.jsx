import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/useCalData';
import LoadingState from '@/components/common/LoadingState';

export default function AdminRoute() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <LoadingState />;
  if (me?.role !== 'admin') {
    return (
      <div className="panel max-w-md mx-auto mt-16 p-10 text-center">
        <ShieldAlert className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <h1 className="text-lg font-semibold">Unauthorized</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">This area is restricted to administrators.</p>
        <Button asChild><Link to="/">Back to Dashboard</Link></Button>
      </div>
    );
  }
  return <Outlet />;
}