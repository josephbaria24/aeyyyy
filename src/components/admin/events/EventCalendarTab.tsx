'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useEventBookings } from '@/lib/admin/queries';
import { adminEventsHref } from '@/lib/admin/events-hub';
import { eventCoversDate } from '@/lib/event-status';
import {
  BOOKING_STATUS_LABEL,
  type BookingStatus,
} from '@/lib/types/booking';
import type { EventBooking } from '@/lib/types/event-booking';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CHIP_STYLES: Record<BookingStatus, string> = {
  confirmed:
    'bg-emerald-100 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-900/50',
  pending:
    'bg-amber-100 text-amber-950 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-900/50',
  declined:
    'bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/40',
  cancelled:
    'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
  rescheduled:
    'bg-sky-100 text-sky-900 ring-sky-200/80 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900/50',
};

function toIsoDate(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function localDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function bookingInMonth(booking: EventBooking, monthStart: Date, monthEnd: Date) {
  const startIso = booking.event_date;
  if (!startIso) return false;
  const start = localDate(startIso);
  const end = localDate(booking.event_end_date || startIso);
  return start <= monthEnd && end >= monthStart;
}

export function EventCalendarTab() {
  const query = useEventBookings();
  const bookings = query.data ?? [];
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => toIsoDate(new Date()));

  const monthKey = format(cursor, 'yyyy-MM');
  const { days, monthStart, monthEnd } = useMemo(() => {
    const start = startOfMonth(localDate(`${monthKey}-01`));
    const end = endOfMonth(start);
    return {
      monthStart: start,
      monthEnd: end,
      days: eachDayOfInterval({ start: startOfWeek(start), end: endOfWeek(end) }),
    };
  }, [monthKey]);

  const monthBookings = useMemo(
    () =>
      bookings
        .filter((b) => bookingInMonth(b, monthStart, monthEnd))
        .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || '')),
    [bookings, monthStart, monthEnd],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, EventBooking[]>();
    for (const day of days) {
      const iso = toIsoDate(day);
      map.set(iso, monthBookings.filter((b) => eventCoversDate(b, iso)));
    }
    return map;
  }, [days, monthBookings]);

  const selectedBookings = byDay.get(selectedDay) ?? [];

  if (query.isPending && !query.data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[13px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Event calendar</h2>
          <p className="mt-1 text-sm text-slate-500">Area bookings by day. Click a date for details.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor((d) => subMonths(d, 1))}
            className="rounded-[9px] admin-hairline p-2"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[9.5rem] text-center text-sm font-bold">{format(cursor, 'MMMM yyyy')}</p>
          <button
            type="button"
            onClick={() => setCursor((d) => addMonths(d, 1))}
            className="rounded-[9px] admin-hairline p-2"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-1 py-2 text-center text-[11px] font-semibold uppercase text-slate-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const iso = toIsoDate(day);
              const inMonth = isSameMonth(day, cursor);
              const dayBookings = byDay.get(iso) ?? [];
              const selected = iso === selectedDay;
              const visible = dayBookings.slice(0, 3);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(iso)}
                  className={cn(
                    'min-h-[7.5rem] border-b border-r border-slate-100 p-1.5 text-left dark:border-slate-800',
                    !inMonth && 'bg-slate-50/80 dark:bg-slate-950/40',
                    selected && 'bg-slate-50 ring-2 ring-inset ring-slate-900/20 dark:bg-slate-800/60',
                    isToday(day) && !selected && 'bg-accent/5',
                  )}
                >
                  <span
                    className={cn(
                      'mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                      isToday(day)
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : inMonth
                          ? 'text-slate-700 dark:text-slate-200'
                          : 'text-slate-300',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {visible.map((b) => (
                      <div
                        key={b.id}
                        className={cn(
                          'truncate rounded px-1 py-0.5 text-[10px] font-semibold ring-1',
                          CHIP_STYLES[b.status],
                        )}
                      >
                        <span className="block truncate">{b.name}</span>
                        <span className="block truncate opacity-80">{b.event_title}</span>
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <p className="px-0.5 text-[10px] font-semibold text-slate-400">
                        +{dayBookings.length - 3} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-[13px] admin-hairline bg-white p-4 dark:bg-slate-900">
          <h3 className="text-sm font-bold">{format(localDate(selectedDay), 'EEE, MMM d')}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {selectedBookings.length} booking{selectedBookings.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
            {selectedBookings.length === 0 && (
              <li className="rounded-[9px] bg-slate-50 px-3 py-6 text-center text-xs text-slate-400 dark:bg-slate-800/50">
                No events on this date
              </li>
            )}
            {selectedBookings.map((b) => (
              <li key={b.id} className={cn('rounded-[9px] p-3 ring-1', CHIP_STYLES[b.status])}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold leading-tight">{b.name}</p>
                  <span className="text-[10px] font-semibold opacity-80">
                    {BOOKING_STATUS_LABEL[b.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold">{b.event_title}</p>
                <p className="mt-1 text-[11px] opacity-80">
                  {b.event_date}
                  {b.event_end_date && b.event_end_date !== b.event_date ? ` → ${b.event_end_date}` : ''}
                  {b.start_time || b.end_time
                    ? ` · ${[b.start_time, b.end_time].filter(Boolean).join('–')}`
                    : ''}
                </p>
                <p className="mt-0.5 font-mono text-[10px] opacity-70">{b.booking_code}</p>
                <Link
                  href={adminEventsHref('bookings', { booking: b.id })}
                  className="mt-2 inline-block text-[11px] font-bold underline-offset-2 hover:underline"
                >
                  Open in Bookings
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
