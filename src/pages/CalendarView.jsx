import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalibrationData } from '@/hooks/useCalData';
import { STATUS_META, STATUSES } from '@/lib/calibration';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import StatusBadge from '@/components/common/StatusBadge';

export default function CalendarView() {
  const { equipment, isLoading } = useCalibrationData();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(format(new Date(), 'yyyy-MM-dd'));
  const byDay = useMemo(() => {
    const m = {};
    equipment.forEach((e) => { if (e.next_due) (m[e.next_due] ||= []).push(e); });
    return m;
  }, [equipment]);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });
  const dayItems = byDay[selected] || [];

  if (isLoading) return <LoadingState />;
  return (
    <div>
      <PageHeader eyebrow="Schedule" title="Calibration Calendar" description="Equipment plotted by next calibration/verification due date.">
        <div className="flex flex-wrap gap-3">{STATUSES.map((s) => <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />{STATUS_META[s].label}</span>)}</div>
      </PageHeader>
      <div className="grid xl:grid-cols-4 gap-6 fade-up">
        <div className="xl:col-span-3 panel p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(format(new Date(), 'yyyy-MM-dd')); }}>Today</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center eyebrow mb-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border">
            {days.map((d) => {
              const key = format(d, 'yyyy-MM-dd');
              const items = byDay[key] || [];
              return (
                <div role="button" tabIndex={0} key={key} onClick={() => setSelected(key)} className={`bg-white min-h-[64px] md:min-h-[104px] p-1.5 text-left align-top transition-colors hover:bg-blue-50/50 ${!isSameMonth(d, month) ? 'bg-slate-50/80 text-slate-400' : ''} ${selected === key ? 'ring-2 ring-inset ring-primary' : ''}`}>
                  <span className={`text-xs inline-flex h-6 w-6 items-center justify-center rounded-full ${isToday(d) ? 'bg-primary text-white font-semibold' : ''}`}>{format(d, 'd')}</span>
                  <div className="hidden md:block space-y-0.5 mt-1">
                    {items.slice(0, 3).map((e) => (
                      <Link key={e.id} to={`/equipment/${e.id}`} onClick={(ev) => ev.stopPropagation()} className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${STATUS_META[e.status].hero}`}>{e.equipment_code}</Link>
                    ))}
                    {items.length > 3 && <p className="text-[10px] text-muted-foreground px-1">+{items.length - 3} more</p>}
                  </div>
                  <div className="md:hidden flex flex-wrap gap-0.5 mt-1">{items.map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${STATUS_META[e.status].dot}`} />)}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel p-6">
          <p className="eyebrow mb-1">Due on</p>
          <p className="text-lg font-semibold mb-4">{format(new Date(selected + 'T00:00:00'), 'EEEE, d MMM yyyy')}</p>
          {dayItems.length === 0 ? <p className="text-sm text-muted-foreground">No equipment due on this day.</p> : (
            <div className="space-y-2">{dayItems.map((e) => (
              <Link key={e.id} to={`/equipment/${e.id}`} className="block rounded-lg border p-3 hover:border-primary/40 hover:bg-blue-50/30 transition-all">
                <p className="font-mono text-[11px] text-primary">{e.equipment_code}</p>
                <p className="text-sm font-medium">{e.equipment_name}</p>
                <div className="mt-2"><StatusBadge status={e.status} /></div>
              </Link>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}