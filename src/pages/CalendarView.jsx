import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalibrationData } from '@/hooks/useCalData';
import { STATUS_META, STATUSES } from '@/lib/calibration';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import StatusBadge from '@/components/common/StatusBadge';

// Chip colours chosen for readable text (the lighter status colours failed contrast with white text).
const CHIP = {
  valid: 'bg-emerald-700 text-white',
  near: 'bg-yellow-300 text-yellow-950',
  due_soon: 'bg-orange-700 text-white',
  expired: 'bg-red-700 text-white',
  unknown: 'bg-slate-200 text-slate-900',
};
const keyOf = (d) => format(d, 'yyyy-MM-dd');

export default function CalendarView() {
  const { equipment, isLoading } = useCalibrationData();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(keyOf(new Date()));
  const gridRef = useRef(null);
  const focusAfterMove = useRef(false);
  const byDay = useMemo(() => {
    const m = {};
    equipment.forEach((e) => { if (e.next_due) (m[e.next_due] ||= []).push(e); });
    return m;
  }, [equipment]);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });
  const dayItems = byDay[selected] || [];
  // Roving tab stop: one day is tabbable (the selected one, or the 1st of the month if the selection is off-screen).
  const tabbable = days.some((d) => keyOf(d) === selected) ? selected : keyOf(startOfMonth(month));

  const moveSelected = (delta) => {
    const next = addDays(new Date(selected + 'T00:00:00'), delta);
    setSelected(keyOf(next));
    if (!isSameMonth(next, month)) setMonth(startOfMonth(next));
    focusAfterMove.current = true;
  };
  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    gridRef.current?.querySelector(`[data-day="${selected}"]`)?.focus();
  }, [selected, month]);
  const onGridKeyDown = (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (step && event.target.matches('[data-day]')) { event.preventDefault(); moveSelected(step); }
  };

  if (isLoading) return <LoadingState />;
  return (
    <div>
      <PageHeader eyebrow="Schedule" title="Calibration Calendar" description="Equipment plotted by next calibration/verification due date.">
        <ul className="flex flex-wrap gap-3" aria-label="Status legend">{STATUSES.map((s) => <li key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].dot}`} aria-hidden="true" />{STATUS_META[s].label}</li>)}</ul>
      </PageHeader>
      <div className="grid xl:grid-cols-4 gap-6 fade-up">
        <div className="xl:col-span-3 panel p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" aria-live="polite">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-10 w-10 md:h-9 md:w-9" aria-label="Previous month" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-10 md:h-9" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(keyOf(new Date())); }}>Today</Button>
              <Button variant="outline" size="icon" className="h-10 w-10 md:h-9 md:w-9" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center eyebrow mb-2" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}</div>
          <div ref={gridRef} role="group" aria-label={`Calendar for ${format(month, 'MMMM yyyy')}. Use arrow keys to move between days.`} onKeyDown={onGridKeyDown} className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border">
            {days.map((d) => {
              const key = keyOf(d);
              const items = byDay[key] || [];
              const label = `${format(d, 'EEEE, d MMMM yyyy')}${items.length ? `, ${items.length} due` : ', nothing due'}`;
              return (
                <div key={key} onClick={() => setSelected(key)} className={`bg-white min-h-[64px] md:min-h-[104px] p-1.5 text-left align-top transition-colors hover:bg-blue-50/50 ${!isSameMonth(d, month) ? 'bg-slate-50/80 text-slate-500' : ''} ${selected === key ? 'ring-2 ring-inset ring-primary' : ''}`}>
                  <button type="button" data-day={key} tabIndex={key === tabbable ? 0 : -1} aria-label={label} aria-pressed={selected === key} aria-current={isToday(d) ? 'date' : undefined}
                    onClick={(ev) => { ev.stopPropagation(); setSelected(key); }}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isToday(d) ? 'bg-primary text-white font-semibold' : ''}`}>{format(d, 'd')}</button>
                  <div className="hidden md:block space-y-0.5 mt-1">
                    {items.slice(0, 3).map((e) => (
                      <Link key={e.id} to={`/equipment/${e.id}`} onClick={(ev) => ev.stopPropagation()} className={`block truncate rounded px-1.5 py-0.5 text-xs font-medium ${CHIP[e.status] || CHIP.unknown}`}>{e.equipment_code}</Link>
                    ))}
                    {items.length > 3 && <p className="text-xs text-muted-foreground px-1">+{items.length - 3} more</p>}
                  </div>
                  <div className="md:hidden flex flex-wrap gap-0.5 mt-1" aria-hidden="true">{items.map((e) => <span key={e.id} className={`h-2 w-2 rounded-full ${STATUS_META[e.status].dot}`} />)}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel p-6" aria-live="polite">
          <p className="eyebrow mb-1">Due on</p>
          <p className="text-lg font-semibold mb-4">{format(new Date(selected + 'T00:00:00'), 'EEEE, d MMM yyyy')}</p>
          {dayItems.length === 0 ? <p className="text-sm text-muted-foreground">No equipment due on this day.</p> : (
            <div className="space-y-2">{dayItems.map((e) => (
              <Link key={e.id} to={`/equipment/${e.id}`} className="block rounded-lg border p-3 hover:border-primary/40 hover:bg-blue-50/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <p className="font-mono text-xs text-primary">{e.equipment_code}</p>
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
