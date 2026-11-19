import React from 'react';
import { Link } from 'react-router-dom';
import { FileWarning, Hourglass, OctagonAlert } from 'lucide-react';

const plural = (n, one, many) => (n === 1 ? one : many);

// "Needs attention" strip. It uses the same status buckets as the stat cards below it
// (Expired / Near Expiration), so the numbers here always match the cards and the Masterlist filter they open.
export default function AlertStrip({ equipment, reports, me }) {
  const expired = equipment.filter((e) => e.status === 'expired').length;
  const nearExpiration = equipment.filter((e) => e.status === 'due_soon').length;
  const action = me?.role === 'admin'
    ? reports.filter((r) => ['submitted', 'reviewed'].includes(r.status)).length
    : reports.filter((r) => r.created_by_id === me?.id && ['rejected', 'draft'].includes(r.status)).length;
  const alerts = [
    expired > 0 && { text: `${expired} equipment ${plural(expired, 'is', 'are')} expired — verify now.`, to: '/masterlist?status=expired', tone: 'text-red-900 bg-red-50 border-red-200', icon: OctagonAlert },
    nearExpiration > 0 && { text: `${nearExpiration} equipment ${plural(nearExpiration, 'is', 'are')} near expiration.`, to: '/masterlist?status=due_soon', tone: 'text-orange-900 bg-orange-50 border-orange-200', icon: Hourglass },
    action > 0 && { text: `${action} ${plural(action, 'report requires', 'reports require')} your action.`, to: '/reports', tone: 'text-blue-900 bg-blue-50 border-blue-200', icon: FileWarning },
  ].filter(Boolean);
  if (!alerts.length) return null;
  return (
    <section aria-label="Needs attention" className="grid md:grid-cols-3 gap-3 mb-6 fade-up">
      {alerts.map((a) => (
        <Link key={a.text} to={a.to} className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium hover:shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${a.tone}`}>
          <a.icon className="h-4 w-4 shrink-0" aria-hidden="true" />{a.text}
        </Link>
      ))}
    </section>
  );
}
