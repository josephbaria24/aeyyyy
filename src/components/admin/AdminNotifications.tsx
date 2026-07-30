'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminIcon, adminIcons } from '@/components/admin/AdminIcon';
import { useBookings } from '@/lib/admin/queries';
import { adminRoomsHref } from '@/lib/admin/rooms-hub';
import type { Booking } from '@/lib/types/booking';
import { BOOKING_STATUS_LABEL } from '@/lib/types/booking';
import { cn } from '@/lib/utils';

function relativeTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function bookingHubHref(booking: Booking) {
  return adminRoomsHref('bookings', {
    guest: booking.email,
    booking: booking.id,
  });
}

function NotificationRow({ booking }: { booking: Booking }) {
  return (
    <DropdownMenuItem asChild className="cursor-pointer p-0 focus:bg-transparent">
      <Link
        href={bookingHubHref(booking)}
        prefetch
        className="flex w-full items-start gap-3 rounded-[9px] px-3 py-2.5 outline-none transition hover:bg-slate-50 focus:bg-slate-50 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
          <AdminIcon icon={adminIcons.bookings} width={16} height={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
            New booking · {booking.booking_code}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {booking.name} · {booking.destination}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
            {booking.check_in} → {booking.check_out}
            {booking.created_at ? ` · ${relativeTime(booking.created_at)}` : ''}
          </span>
        </span>
        <span className="mt-1 shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          Pending
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

export function AdminNotifications() {
  const { data: bookings = [], isPending } = useBookings();

  const pending = useMemo(
    () => bookings.filter((b) => b.status === 'pending'),
    [bookings],
  );

  const recentActivity = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return bookings
      .filter((b) => b.status !== 'pending' && new Date(b.created_at).getTime() >= cutoff)
      .slice(0, 4);
  }, [bookings]);

  const badgeCount = pending.length;
  const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label={
            badgeCount > 0
              ? `Notifications, ${badgeCount} pending booking${badgeCount === 1 ? '' : 's'}`
              : 'Notifications'
          }
        >
          <AdminIcon icon={adminIcons.bell} width={20} height={20} />
          {badgeCount > 0 && (
            <span
              className={cn(
                'absolute right-1 top-1 flex min-w-[1.05rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white',
                badgeCount > 9 ? 'h-4 px-1' : 'h-4 w-4',
              )}
            >
              {badgeLabel}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1.5rem))] rounded-[13px] border-slate-200 p-0 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-bold text-slate-900 dark:text-slate-100">
            Notifications
          </DropdownMenuLabel>
          {badgeCount > 0 && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              {badgeCount} pending
            </span>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[22rem] overflow-y-auto py-1">
          {isPending && bookings.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : pending.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                You&apos;re all caught up
              </p>
              <p className="mt-1 text-xs text-slate-400">No pending booking requests</p>
            </div>
          ) : (
            <>
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Booking requests
              </p>
              {pending.slice(0, 12).map((booking) => (
                <NotificationRow key={booking.id} booking={booking} />
              ))}
            </>
          )}

          {recentActivity.length > 0 && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Recent activity
              </p>
              {recentActivity.map((booking) => (
                <DropdownMenuItem
                  asChild
                  key={booking.id}
                  className="cursor-pointer p-0 focus:bg-transparent"
                >
                  <Link
                    href={bookingHubHref(booking)}
                    prefetch
                    className="flex w-full items-start gap-3 rounded-[9px] px-3 py-2.5 outline-none transition hover:bg-slate-50 focus:bg-slate-50 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        booking.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : booking.status === 'rescheduled'
                            ? 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                      )}
                    >
                      <AdminIcon
                        icon={
                          booking.status === 'confirmed'
                            ? adminIcons.confirmed
                            : adminIcons.bookings
                        }
                        width={16}
                        height={16}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                        {BOOKING_STATUS_LABEL[booking.status] ?? booking.status} ·{' '}
                        {booking.booking_code}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {booking.name} · {booking.destination}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
                        {relativeTime(booking.created_at)}
                      </span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <DropdownMenuItem asChild className="cursor-pointer p-0 focus:bg-transparent">
            <Link
              href={adminRoomsHref('bookings')}
              prefetch
              className="flex w-full items-center justify-center rounded-[9px] px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
            >
              View all bookings
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
