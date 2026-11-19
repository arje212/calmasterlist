import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import DueCell from '@/components/masterlist/DueCell';
import EmptyState from '@/components/common/EmptyState';

export default function UpcomingList({ equipment }) {
  const items = equipment.filter((e) => e.days_left !== null && e.days_left <= 60).sort((a, b) => a.days_left - b.days_left).slice(0, 7);
  return (
    <div className="panel p-6 h-full">
      <div className="flex items-center justify-between mb-3"><p className="eyebrow">Upcoming & Overdue Calibration</p><Link to="/calendar" className="text-xs text-primary hover:underline">Calendar</Link></div>
      {items.length === 0 ? <EmptyState icon={CalendarClock} title="Nothing due in the next 60 days" /> : (
        <div className="divide-y">
          {items.map((e) => (
            <Link key={e.id} to={`/equipment/${e.id}`} className="flex items-center justify-between py-3 gap-3 group">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{e.equipment_name}</p>
                <p className="text-xs font-mono text-muted-foreground">{e.equipment_code} · {e.department}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0"><DueCell date={e.next_due} days={e.days_left} /><span className="hidden sm:inline"><StatusBadge status={e.status} /></span></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}