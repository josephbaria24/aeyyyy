'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DayPicker,
  type DateRange,
  type DayButtonProps,
} from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { OccupancyStay } from '@/lib/room-status';
import { stayDayKind, type StayDayKind } from '@/components/StayAvailabilityCalendar';
import { todayIsoLocal } from '@/lib/event-status';
import { cn } from '@/lib/utils';

const KIND_STYLES: Record<StayDayKind, string> = {
  available:
    'bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/40 data-[selected-single=true]:bg-emerald-400 data-[selected-single=true]:text-[#0a1628]',
  reserved:
    'bg-sky-500/30 text-sky-100 line-through decoration-sky-200/50 opacity-90',
  occupied:
    'bg-amber-500/35 text-amber-50 line-through decoration-amber-100/40 opacity-90',
  unavailable: 'bg-white/10 text-white/35 line-through',
};

function toIso(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function localDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function displayDate(iso: string) {
  if (!iso) return '';
  return format(localDate(iso), 'MM/dd/yyyy');
}

type EventAreaCalendarProps = {
  from: string;
  until: string;
  stays: OccupancyStay[];
  areaUnavailable?: boolean;
  onChange: (next: { from: string; until: string }) => void;
  className?: string;
};

function DarkDayButton(props: DayButtonProps) {
  const { day, modifiers, ...buttonProps } = props;
  const kind = (modifiers.available
    ? 'available'
    : modifiers.reserved
      ? 'reserved'
      : modifiers.occupied
        ? 'occupied'
        : modifiers.blocked
          ? 'unavailable'
          : null) as StayDayKind | null;

  return (
    <button
      {...buttonProps}
      type="button"
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
          ? 'true'
          : undefined
      }
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
        'text-white/90 hover:bg-white/10',
        modifiers.outside && 'text-white/30',
        modifiers.disabled && 'pointer-events-none opacity-35',
        modifiers.today && !modifiers.selected && 'ring-1 ring-white/40',
        modifiers.range_start && 'rounded-l-md bg-accent text-white',
        modifiers.range_end && 'rounded-r-md bg-accent text-white',
        modifiers.range_middle && 'rounded-none bg-accent/35 text-white',
        kind && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
          ? KIND_STYLES[kind]
          : null,
        modifiers.selected &&
          !modifiers.range_middle &&
          'ring-2 ring-white ring-offset-1 ring-offset-[#1c2433]',
      )}
    />
  );
}

export function EventAreaCalendar({
  from,
  until,
  stays,
  areaUnavailable = false,
  onChange,
  className,
}: EventAreaCalendarProps) {
  const [open, setOpen] = useState(false);
  const today = todayIsoLocal();
  const todayDate = localDate(today);

  const selected: DateRange | undefined = useMemo(() => {
    if (!from) return undefined;
    return {
      from: localDate(from),
      to: until ? localDate(until) : localDate(from),
    };
  }, [from, until]);

  const occupiedMatchers = useMemo(() => {
    const dates: Date[] = [];
    for (const stay of stays) {
      let cursor = localDate(stay.check_in);
      const end = localDate(stay.check_out);
      while (cursor < end) {
        const iso = toIso(cursor);
        if (stayDayKind(iso, stays, { today, roomUnavailable: areaUnavailable }) === 'occupied') {
          dates.push(new Date(cursor));
        }
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return dates;
  }, [stays, today, areaUnavailable]);

  const reservedMatchers = useMemo(() => {
    const dates: Date[] = [];
    for (const stay of stays) {
      let cursor = localDate(stay.check_in);
      const end = localDate(stay.check_out);
      while (cursor < end) {
        const iso = toIso(cursor);
        if (stayDayKind(iso, stays, { today, roomUnavailable: areaUnavailable }) === 'reserved') {
          dates.push(new Date(cursor));
        }
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return dates;
  }, [stays, today, areaUnavailable]);

  const isBookedIso = (iso: string) => {
    const kind = stayDayKind(iso, stays, { today, roomUnavailable: areaUnavailable });
    return kind === 'occupied' || kind === 'reserved' || kind === 'unavailable';
  };

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onChange({ from: '', until: '' });
      return;
    }
    const fromIso = toIso(range.from);
    if (isBookedIso(fromIso)) return;

    if (!range.to || toIso(range.to) === fromIso) {
      onChange({ from: fromIso, until: fromIso });
      return;
    }

    const toIsoStr = toIso(range.to);
    let cursor = localDate(fromIso);
    const end = localDate(toIsoStr);
    while (cursor <= end) {
      const iso = toIso(cursor);
      if (iso !== fromIso && isBookedIso(iso)) {
        const prev = new Date(cursor);
        prev.setDate(prev.getDate() - 1);
        onChange({ from: fromIso, until: toIso(prev) });
        setOpen(false);
        return;
      }
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
    onChange({ from: fromIso, until: toIsoStr });
    setOpen(false);
  };

  const label =
    from && until && until !== from
      ? `${displayDate(from)} → ${displayDate(until)}`
      : from
        ? displayDate(from)
        : 'Select event dates';

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left text-white transition-colors hover:border-accent focus:border-accent focus:outline-none"
          >
            <span className={cn(!from && 'text-white/45')}>{label}</span>
            <CalendarDays className="h-4 w-4 shrink-0 text-white/60" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto border-white/10 bg-[#1c2433] p-0 text-white shadow-xl"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-white">Choose dates</p>
            <p className="mt-0.5 text-xs text-white/50">
              Green = available · Blue = reserved · Amber = in use
            </p>
          </div>

          <DayPicker
            mode="range"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={from ? localDate(from) : todayDate}
            disabled={[
              { before: todayDate },
              ...(areaUnavailable ? [{ from: todayDate, to: new Date(2100, 0, 1) }] : []),
              ...occupiedMatchers,
              ...reservedMatchers,
            ]}
            modifiers={{
              available: (date) => {
                const iso = toIso(date);
                if (iso < today) return false;
                return stayDayKind(iso, stays, { today, roomUnavailable: areaUnavailable }) === 'available';
              },
              reserved: reservedMatchers,
              occupied: occupiedMatchers,
              blocked: areaUnavailable
                ? [{ from: todayDate, to: new Date(2100, 0, 1) }]
                : [],
            }}
            components={{
              DayButton: DarkDayButton,
              Chevron: ({ orientation, ...props }) =>
                orientation === 'left' ? (
                  <ChevronLeft className="h-4 w-4" {...props} />
                ) : (
                  <ChevronRight className="h-4 w-4" {...props} />
                ),
            }}
            classNames={{
              root: 'p-3',
              months: 'flex flex-col',
              month: 'space-y-3',
              month_caption: 'flex items-center justify-center pt-1 relative',
              caption_label: 'text-sm font-semibold text-white',
              nav: 'flex items-center gap-1',
              button_previous:
                'absolute left-1 top-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10',
              button_next:
                'absolute right-1 top-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10',
              weekdays: 'flex',
              weekday: 'w-9 text-center text-[11px] font-medium text-white/45',
              week: 'mt-1 flex w-full',
              day: 'p-0.5',
              outside: 'opacity-40',
              disabled: 'opacity-35',
              hidden: 'invisible',
            }}
          />

          <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
            <button
              type="button"
              className="text-xs font-semibold text-sky-300 hover:text-sky-200"
              onClick={() => onChange({ from: '', until: '' })}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-sky-300 hover:text-sky-200"
              onClick={() => onChange({ from: today, until: today })}
            >
              Today
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400/80" /> Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-400/80" /> Reserved
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/80" /> In use
        </span>
        {areaUnavailable && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-white/30" /> Unavailable
          </span>
        )}
      </div>

      <input type="hidden" name="eventFrom" value={from} required />
    </div>
  );
}
