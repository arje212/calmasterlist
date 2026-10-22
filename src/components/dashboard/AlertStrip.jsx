import React from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { addDays } from 'date-fns';
import { isoDate, today } from '@/lib/calibration';

export default function AlertStrip({ equipment, reports, me, settings }) {
  const near = equipment.filter((e) => e.days_left !== null && e.days_left >= 0 && e.days_left <= Number(settings.near_days)).length;
  const nearDueRange = { from: today(), to: isoDate(addDays(new Date(), Number(settings.near_days))) };
  const expired = equipment.filter((e) => e.status === 'expired').length;
  const action = me?.role === 'admin'
    ? reports.filter((r) => ['submitted', 'reviewed'].includes(r.status)).length
    : reports.filter((r) => r.created_by_id === me?.id && ['rejected', 'draft'].includes(r.status)).length;
  const alerts = [
    near > 0 && { text: `${near} equipment are due within ${settings.near_days} days.`, to: `/masterlist?from=${nearDueRange.from}&to=${nearDueRange.to}`, tone: 'text-yellow-800 bg-yellow-50 border-yellow-200' },
    action > 0 && { text: `${action} reports require action.`, to: '/reports', tone: 'text-blue-800 bg-blue-50 border-blue-200' },
    expired > 0 && { text: `${expired} equipment are already expired.`, to: '/masterlist?status=expired', tone: 'text-red-800 bg-red-50 border-red-200' },
  ].filter(Boolean);
  if (!alerts.length) return null;
  return (
    <div className="grid md:grid-cols-3 gap-3 mb-6 fade-up">
      {alerts.map((a) => (
        <Link key={a.text} to={a.to} className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm hover:shadow-sm transition-shadow ${a.tone}`}>
          <Bell className="h-4 w-4 shrink-0" />{a.text}
        </Link>
      ))}
    </div>
  );
}