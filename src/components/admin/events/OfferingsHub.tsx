'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AreasTab } from '@/components/admin/events/AreasTab';
import { EventStatusTab } from '@/components/admin/events/EventStatusTab';
import { EventCalendarTab } from '@/components/admin/events/EventCalendarTab';
import { EventBookingsTab } from '@/components/admin/events/EventBookingsTab';
import {
  adminEventsHref,
  parseEventsHubTab,
  type EventsHubTab,
} from '@/lib/admin/events-hub';
import { adminPoolHref } from '@/lib/admin/pool-hub';
import { useEventBookings, useOfferings } from '@/lib/admin/queries';
import type { OfferingCategory } from '@/lib/types/event-offering';
import { cn } from '@/lib/utils';

const EVENT_TABS: { id: EventsHubTab; label: string }[] = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'status', label: 'Status' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'areas', label: 'Areas' },
];

const POOL_TABS: { id: EventsHubTab; label: string }[] = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'status', label: 'Status' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'areas', label: 'Packages' },
];

export function OfferingsHub({ category }: { category: OfferingCategory }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseEventsHubTab(searchParams.get('tab'));
  const booking = searchParams.get('booking');
  const { data: bookings = [] } = useEventBookings();
  const { data: offerings = [] } = useOfferings();
  const tabs = category === 'pool' ? POOL_TABS : EVENT_TABS;

  const pendingCount = useMemo(() => {
    const catById = new Map(offerings.map((o) => [o.id, o.category]));
    return bookings.filter((b) => {
      if (b.status !== 'pending') return false;
      return (catById.get(b.offering_id ?? '') ?? 'event') === category;
    }).length;
  }, [bookings, offerings, category]);
  const pendingLabel = pendingCount > 99 ? '99+' : String(pendingCount);

  const hrefFor = useCallback(
    (next: EventsHubTab, opts?: { booking?: string }) =>
      category === 'pool' ? adminPoolHref(next, opts) : adminEventsHref(next, opts),
    [category],
  );

  const go = useCallback(
    (next: EventsHubTab, opts?: { booking?: string }) => {
      router.push(hrefFor(next, opts));
    },
    [router, hrefFor],
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-1 rounded-[11px] admin-hairline bg-white p-1 dark:bg-slate-900">
        {tabs.map((item) => {
          const active = tab === item.id;
          const showPending = item.id === 'bookings' && pendingCount > 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-sm font-semibold transition-colors',
                active
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              )}
            >
              {item.label}
              {showPending && (
                <span
                  className={cn(
                    'inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    active
                      ? 'bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950'
                      : 'bg-amber-500 text-white',
                  )}
                  aria-label={`${pendingCount} pending booking${pendingCount === 1 ? '' : 's'}`}
                >
                  {pendingLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'areas' && <AreasTab category={category} />}
      {tab === 'status' && <EventStatusTab category={category} />}
      {tab === 'calendar' && <EventCalendarTab category={category} />}
      {tab === 'bookings' && (
        <EventBookingsTab category={category} focusBookingId={booking} />
      )}
    </>
  );
}
