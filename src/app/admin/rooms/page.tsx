'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { RoomsTab } from '@/components/admin/rooms/RoomsTab';
import { StatusTab } from '@/components/admin/rooms/StatusTab';
import { CalendarTab } from '@/components/admin/rooms/CalendarTab';
import { BookingsTab } from '@/components/admin/rooms/BookingsTab';
import { GuestsTab } from '@/components/admin/rooms/GuestsTab';
import {
  adminRoomsHref,
  parseRoomsHubTab,
  type RoomsHubTab,
} from '@/lib/admin/rooms-hub';
import { useBookings } from '@/lib/admin/queries';
import { cn } from '@/lib/utils';

const tabs: { id: RoomsHubTab; label: string }[] = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'status', label: 'Status' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'guests', label: 'Guests' },
];

function RoomsHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseRoomsHubTab(searchParams.get('tab'));
  const guest = searchParams.get('guest');
  const booking = searchParams.get('booking');
  const { data: bookings = [] } = useBookings();

  const pendingCount = useMemo(
    () => bookings.filter((b) => b.status === 'pending').length,
    [bookings],
  );
  const pendingLabel = pendingCount > 99 ? '99+' : String(pendingCount);

  const go = useCallback(
    (next: RoomsHubTab, opts?: { guest?: string; booking?: string }) => {
      router.push(adminRoomsHref(next, opts));
    },
    [router],
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

      {tab === 'rooms' && <RoomsTab />}
      {tab === 'status' && <StatusTab />}
      {tab === 'calendar' && <CalendarTab />}
      {tab === 'bookings' && (
        <BookingsTab
          guestEmail={guest}
          focusBookingId={booking}
          onClearGuestFilter={() => go('bookings')}
        />
      )}
      {tab === 'guests' && (
        <GuestsTab onViewBookings={(email) => go('bookings', { guest: email })} />
      )}
    </>
  );
}

export default function AdminRoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <RoomsHubInner />
    </Suspense>
  );
}
