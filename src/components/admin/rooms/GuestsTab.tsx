'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
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
          <div className="overflow-x-auto">
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
                {guests.map((guest) => (
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
                {guests.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-gray-500 dark:text-slate-400"
                    >
                      No guests yet. Guests appear from booking submissions.
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
