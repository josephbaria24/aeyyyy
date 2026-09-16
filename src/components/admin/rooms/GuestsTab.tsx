'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Loader2, Mail, Phone, Search, X } from 'lucide-react';
import { useBookings } from '@/lib/admin/queries';

type GuestRow = {
  name: string;
  email: string;
  phone: string | null;
  bookings: number;
  lastStay: string;
  destinations: string[];
};

export function GuestsTab({
  onViewBookings,
}: {
  onViewBookings: (guestEmail: string) => void;
}) {
  const { data: bookings = [], isPending, error } = useBookings();
  const [search, setSearch] = useState('');

  const guests = useMemo(() => {
    const map = new Map<string, GuestRow>();
    for (const booking of bookings) {
      const key = booking.email.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: booking.name,
          email: booking.email,
          phone: booking.phone,
          bookings: 1,
          lastStay: booking.check_out,
          destinations: [booking.destination],
        });
      } else {
        existing.bookings += 1;
        if (booking.check_out > existing.lastStay) existing.lastStay = booking.check_out;
        if (!existing.destinations.includes(booking.destination)) {
          existing.destinations.push(booking.destination);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.bookings - a.bookings);
  }, [bookings]);

  const filteredGuests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter((guest) =>
      [
        guest.name,
        guest.email,
        guest.phone,
        ...guest.destinations,
      ].some((value) => String(value ?? '').toLowerCase().includes(term)),
    );
  }, [guests, search]);

  return (
    <>
      {error && (
        <div className="mb-4 rounded-[9px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {error.message}
        </div>
      )}

      {isPending && bookings.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0a1628] dark:text-slate-100" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800 sm:px-4 sm:py-3">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Guest directory</p>
              <p className="text-[10px] text-slate-400">
                {search.trim() ? `${filteredGuests.length} of ${guests.length}` : `${guests.length} guests`}
              </p>
            </div>
            <label className="relative min-w-0 max-w-[15rem] flex-1">
              <span className="sr-only">Search guests</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search guests…"
                className="h-9 w-full rounded-[8px] border-0 bg-slate-100 pl-8 pr-8 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/10 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-white/10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-white dark:hover:bg-slate-800"
                  aria-label="Clear guest search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
          </div>

          <div className="max-h-[70dvh] space-y-2 overflow-y-auto bg-slate-50/60 p-2 dark:bg-slate-950/30 md:hidden">
            {filteredGuests.map((guest) => (
              <article
                key={guest.email}
                className="rounded-[11px] border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/30 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
              >
                <div className="flex items-start gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-sky-100 text-xs font-bold text-violet-700 dark:from-violet-950/60 dark:to-sky-950/50 dark:text-violet-300">
                    {(guest.name || guest.email).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                          {guest.name}
                        </p>
                        <p className="flex items-center gap-1 truncate text-[10px] text-slate-400">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{guest.email}</span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                        {guest.bookings} booking{guest.bookings === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 rounded-[8px] bg-slate-50 px-2.5 py-2 dark:bg-slate-950/50">
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    <Phone className="h-3 w-3 shrink-0 text-sky-500" />
                    <span className="truncate">{guest.phone || 'No phone'}</span>
                  </p>
                  <p className="flex min-w-0 items-center justify-end gap-1.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    <CalendarDays className="h-3 w-3 shrink-0 text-emerald-500" />
                    <span className="truncate">{guest.lastStay}</span>
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 gap-1 overflow-hidden">
                    {guest.destinations.slice(0, 2).map((destination) => (
                      <span
                        key={destination}
                        className="max-w-[7rem] truncate rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                      >
                        {destination}
                      </span>
                    ))}
                    {guest.destinations.length > 2 && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500 dark:bg-slate-800">
                        +{guest.destinations.length - 2}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewBookings(guest.email)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-[7px] bg-slate-900 px-2.5 py-1.5 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </article>
            ))}
            {filteredGuests.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {guests.length === 0
                  ? 'No guests yet. Guests appear from booking submissions.'
                  : 'No guests match your search.'}
              </p>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Bookings</th>
                  <th className="px-4 py-3">Last Stay</th>
                  <th className="px-4 py-3">Destinations</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((guest) => (
                  <tr key={guest.email} className="border-b border-gray-50 dark:border-slate-800">
                    <td className="px-4 py-4">
                      <div className="font-medium text-[#0a1628] dark:text-slate-100">
                        {guest.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {guest.email}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-slate-300">
                      {guest.phone || '—'}
                    </td>
                    <td className="px-4 py-4 font-medium">{guest.bookings}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-slate-300">
                      {guest.lastStay}
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-slate-300">
                      {guest.destinations.join(', ')}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onViewBookings(guest.email)}
                        className="rounded-[5px] bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        View bookings
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredGuests.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-gray-500 dark:text-slate-400"
                    >
                      {guests.length === 0
                        ? 'No guests yet. Guests appear from booking submissions.'
                        : 'No guests match your search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
