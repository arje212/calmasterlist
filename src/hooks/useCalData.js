import { useMemo, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { DEFAULT_SETTINGS, enrichEquipment } from '@/lib/calibration';
import { buildNotifications, getReadIds, markRead } from '@/lib/notifications';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => apiClient.auth.me(), staleTime: 5 * 60e3 });

export const useIsAdmin = () => useMe().data?.role === 'admin';

export function useSettings() {
  const q = useQuery({ queryKey: ['settings'], queryFn: async () => (await apiClient.entities.AppSettings.list('-created_date', 1))[0] || null });
  const settings = useMemo(() => {
    const clean = Object.fromEntries(Object.entries(q.data || {}).filter(([, v]) => v !== null && v !== undefined && v !== ''));
    return { ...DEFAULT_SETTINGS, ...clean };
  }, [q.data]);
  return { ...q, settings };
}

export function useCalibrationData() {
  const eq = useQuery({ queryKey: ['equipment'], queryFn: () => apiClient.entities.Equipment.list('equipment_code', 2000) });
  const standards = useQuery({ queryKey: ['standard-equipment'], queryFn: () => apiClient.entities.StandardEquipment.list() });
  const vr = useQuery({ queryKey: ['verifications'], queryFn: () => apiClient.entities.VerificationRecord.list('-verification_date', 5000) });
  const rp = useQuery({ queryKey: ['reports'], queryFn: () => apiClient.entities.Report.list('-created_date', 5000) });
  const { settings, isLoading: sl } = useSettings();
  const equipment = useMemo(
    () => enrichEquipment((eq.data || []).filter((e) => !e.deleted), vr.data || [], rp.data || [], settings),
    [eq.data, vr.data, rp.data, settings]
  );
  return { equipment, standardEquipment: standards.data || [], verifications: vr.data || [], reports: rp.data || [], settings, isLoading: eq.isLoading || standards.isLoading || vr.isLoading || rp.isLoading || sl };
}

export function useExternalCalibrations(options = {}) {
  return useQuery({
    queryKey: ['external-calibrations'],
    queryFn: () => apiClient.externalCalibrations.list(),
    enabled: options.enabled !== false,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useNotifications() {
  const { equipment, settings, isLoading } = useCalibrationData();
  const { data: me } = useMe();
  const [readIds, setReadIds] = useState(getReadIds());
  const queryClient = useQueryClient();
  const notificationQuery = useQuery({
    queryKey: ['notifications', me?.id],
    queryFn: () => apiClient.notifications.list(),
    enabled: Boolean(me?.id),
  });
  useEffect(() => {
    const h = () => setReadIds(getReadIds());
    window.addEventListener('notifications-read', h);
    return () => window.removeEventListener('notifications-read', h);
  }, []);
  const equipmentAlerts = useMemo(() => buildNotifications({ equipment, settings }), [equipment, settings]);
  const storedItems = notificationQuery.data?.items || [];
  const items = useMemo(() => [
    ...storedItems.map((notification) => ({
      ...notification,
      id: notification.id,
      type: notification.category,
      date: notification.created_at,
      link: notification.report_url,
      persisted: true,
    })),
    ...equipmentAlerts,
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))), [storedItems, equipmentAlerts]);
  const allReadIds = useMemo(() => new Set([
    ...readIds,
    ...storedItems.filter((notification) => notification.is_read).map((notification) => notification.id),
  ]), [readIds, storedItems]);
  const markNotificationRead = async (item) => {
    if (item.persisted) {
      await apiClient.notifications.markRead(item.id);
      await queryClient.invalidateQueries({ queryKey: ['notifications', me?.id] });
    } else {
      markRead([item.id]);
    }
  };
  const markAllNotificationsRead = async () => {
    await apiClient.notifications.markAllRead();
    markRead(equipmentAlerts.map((item) => item.id));
    await queryClient.invalidateQueries({ queryKey: ['notifications', me?.id] });
  };
  const serverUnread = notificationQuery.data?.unread
    ?? storedItems.filter((notification) => !notification.is_read).length;
  const equipmentUnread = equipmentAlerts.filter((item) => !readIds.has(item.id)).length;
  const unread = serverUnread + equipmentUnread;
  return {
    items,
    readIds: allReadIds,
    unread,
    isLoading: isLoading || notificationQuery.isLoading,
    notificationError: notificationQuery.error,
    refetchNotifications: notificationQuery.refetch,
    markNotificationRead,
    markAllNotificationsRead,
  };
}