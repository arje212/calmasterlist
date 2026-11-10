const preferenceKey = (userId) => `cal_desktop_notifications_${userId}`;
const shownKey = (userId) => `cal_desktop_notification_ids_${userId}`;

export function desktopNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function desktopNotificationsEnabled(userId) {
  try {
    return Boolean(userId && window.localStorage.getItem(preferenceKey(userId)) === 'true');
  } catch {
    return false;
  }
}

export function setDesktopNotificationsEnabled(userId, enabled) {
  if (!userId) return;
  window.localStorage.setItem(preferenceKey(userId), String(enabled));
}

export async function requestDesktopNotificationPermission() {
  if (!desktopNotificationsSupported()) return 'unsupported';
  if (window.Notification.permission !== 'default') return window.Notification.permission;
  return window.Notification.requestPermission();
}

export function showDesktopNotification(userId, notification) {
  if (!userId || !desktopNotificationsSupported() || window.Notification.permission !== 'granted') return;
  let shown;
  try {
    const stored = JSON.parse(window.localStorage.getItem(shownKey(userId)) || '[]');
    shown = Array.isArray(stored) ? stored : [];
  } catch {
    shown = [];
  }
  if (shown.includes(notification.id)) return;
  const toast = new window.Notification(notification.title, {
    body: notification.message,
    icon: '/notification-icon.svg',
    tag: notification.id,
  });
  window.localStorage.setItem(shownKey(userId), JSON.stringify([...shown.slice(-99), notification.id]));
  toast.onclick = () => {
    const destination = new URL(notification.report_url, window.location.origin);
    if (destination.origin !== window.location.origin) return;
    window.focus();
    window.location.assign(destination.href);
    toast.close();
  };
}
