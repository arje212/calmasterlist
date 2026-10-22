import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/api/apiClient';
import { useMe, useInvalidate } from '@/hooks/useCalData';
import { logAudit } from '@/lib/audit';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import InviteUserDialog from '@/components/users/InviteUserDialog';
import UserActivityDialog from '@/components/users/UserActivityDialog';
import UserProfileDialog from '@/components/users/UserProfileDialog';
import UserRow from '@/components/users/UserRow';

export default function Users() {
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => apiClient.entities.User.list('-created_date', 500) });
  const { data: logs = [] } = useQuery({ queryKey: ['audit-all'], queryFn: () => apiClient.entities.AuditLog.list('-created_date', 2000) });
  const [inviting, setInviting] = useState(false);
  const [activityUser, setActivityUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);

  const update = async (u, data, action, details) => {
    try {
      await apiClient.entities.User.update(u.id, data);
      await logAudit(me, { action, entity_type: 'User', entity_id: u.id, entity_label: u.email, details });
      invalidate('users', 'audit-all', 'me');
      toast.success('User updated');
      return true;
    } catch (error) {
      toast.error(error.message || 'Could not update user');
      return false;
    }
  };
  const reset = async (u) => {
    const password = window.prompt(`Set a temporary password for ${u.id_number || u.username}. Use at least 10 characters.`);
    if (!password) return;
    try {
      await apiClient.users.resetPassword(u.id, password);
      toast.success('Temporary password set. Share it directly with the user.');
    } catch (error) {
      toast.error(error.message || 'Could not reset password');
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Administration" title="User Management" description="Invite users and assign Staff, Sr. Staff, QA Manager, or Admin workflow roles.">
        <Button className="gap-2" onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" />Create User</Button>
      </PageHeader>
      {isLoading ? <LoadingState /> : (
        <div className="panel divide-y fade-up">
          {users.map((u) => (
            <UserRow key={u.id} u={u} isSelf={u.id === me?.id} activityCount={logs.filter((l) => l.user_email === u.email).length}
              onRole={(role) => update(u, { role }, 'user_role', `${u.role === 'admin' ? 'ADMIN' : 'STAFF'} → ${role === 'admin' ? 'ADMIN' : 'STAFF'}`)}
              onToggle={() => update(u, { disabled: !u.disabled }, u.disabled ? 'user_enable' : 'user_disable')}
              onReset={() => reset(u)} onActivity={() => setActivityUser(u)} onEdit={() => setProfileUser(u)} />
          ))}
        </div>
      )}
      <InviteUserDialog open={inviting} onClose={() => { setInviting(false); invalidate('users'); }} me={me} />
      <UserActivityDialog user={activityUser} logs={logs} onClose={() => setActivityUser(null)} />
      <UserProfileDialog user={profileUser} onClose={() => setProfileUser(null)} onSave={(user, values) => update(user, values, 'user_profile', 'Updated report name, position, or signature')} />
    </div>
  );
}