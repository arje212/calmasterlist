import { apiClient } from '@/api/apiClient';
import { FIELD_LABELS } from '@/lib/calibration';

export const roleLabel = (user) => ({ admin: 'ADMIN', user: 'STAFF / INSPECTOR', sr_staff: 'SR. STAFF', qa_manager: 'QA MANAGER' }[user?.role] || 'STAFF / INSPECTOR');

export function logAudit(user, { action, entity_type, entity_id, entity_label, equipment_id, changes = [], details = '' }) {
  return apiClient.entities.AuditLog.create({
    user_name: user?.full_name || user?.email || 'Unknown',
    user_email: user?.email,
    user_role: roleLabel(user),
    action, entity_type, entity_id, entity_label, equipment_id, changes, details,
  });
}

export function diffChanges(oldObj, newObj, fields) {
  return fields
    .filter((f) => String(oldObj?.[f] ?? '') !== String(newObj?.[f] ?? ''))
    .map((f) => ({ field: FIELD_LABELS[f] || f, from: String(oldObj?.[f] ?? ''), to: String(newObj?.[f] ?? '') }));
}

export const ACTION_LABELS = {
  create: 'Created', update: 'Updated', delete: 'Deleted', verify: 'Recorded verification',
  report_create: 'Created report', report_update: 'Updated report', report_submit: 'Submitted report',
  report_review: 'Reviewed report', report_approve: 'Approved report', report_reject: 'Rejected report',
  report_delete: 'Deleted report', attachment_remove: 'Removed attachment', settings_update: 'Updated settings',
  user_invite: 'Invited user', user_role: 'Changed user role', user_disable: 'Disabled user', user_enable: 'Enabled user',
  login: 'Logged in', logout: 'Logged out',
};