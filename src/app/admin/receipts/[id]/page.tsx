'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { adminKeys, useBooking, useRooms } from '@/lib/admin/queries';
import {
  calculateStayAmount,
  formatMoney,
  nightsBetween,
} from '@/lib/money';
import {
  bookingGrandTotal,
  bookingUnpaid,
  normalizeBooking,
  otherChargesTotal,
  type Booking,
} from '@/lib/types/booking';

export default function BookingReceiptPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const cachedList = queryClient.getQueryData<Booking[]>(adminKeys.bookings);
  const cachedBooking = cachedList?.find((b) => b.id === params.id);

  const { data: fetchedBooking, isPending, error } = useBooking(params.id);
  const { data: rooms = [] } = useRooms();
  const resolved = fetchedBooking ?? (cachedBooking ? normalizeBooking(cachedBooking) : null);

  const pricing = useMemo(() => {
    if (!resolved) return null;
    const room = rooms.find(
      (r) => r.name.toLowerCase() === resolved.destination.trim().toLowerCase(),
    );
    const nights = nightsBetween(resolved.check_in, resolved.check_out);
    const rate =
      Number(resolved.rate_per_night) > 0
        ? Number(resolved.rate_per_night)
        : Number(room?.price_per_night) || 0;
    const staySaved = Number(resolved.amount) || 0;
    const stayEstimated =
      rate > 0
        ? calculateStayAmount(
            rate,
            resolved.check_in,
            resolved.check_out,
            Number(resolved.rooms) || 1,
          )
        : 0;
    const stay = staySaved > 0 ? staySaved : stayEstimated;
    const extras = otherChargesTotal(resolved.other_charges);
    const paid = Number(resolved.amount_paid) || 0;
    const bookingForTotals = {
      ...resolved,
      amount: stay,
      rate_per_night: rate,
    };
    return {
      nights,
      rate,
      stay,
      extras,
      paid,
      due: bookingGrandTotal(bookingForTotals),
      unpaid: bookingUnpaid(bookingForTotals),
      charges: resolved.other_charges ?? [],
    };
  }, [resolved, rooms]);

  if (isPending && !resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0a1628] dark:text-slate-100" />
      </div>
    );
  }

  if ((error && !resolved) || !resolved) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-red-500 dark:text-red-400">{error?.message || 'Receipt not found'}</p>
        <Link
          href="/admin/rooms?tab=bookings"
          prefetch
          className="mt-4 inline-block text-accent hover:underline"
        >
          Back to bookings
        </Link>
      </div>
    );
  }

  const booking = resolved;

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto mb-4 flex max-w-2xl items-center justify-between print:hidden">
        <Link
          href="/admin/rooms?tab=bookings"
          prefetch
          className="inline-flex items-center text-sm text-[#0a1628] hover:underline dark:text-slate-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center rounded-[9px] bg-[#0a1628] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      <div
        id="receipt"
        className="mx-auto max-w-2xl rounded-[13px] bg-white p-8 sm:p-10 dark:bg-slate-900"
      >
        <div className="border-b border-gray-200 pb-6 dark:border-slate-700">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="Aeyyyy Traveller's Inn"
              className="h-14 w-14 rounded-full object-cover"
            />
            <div className="flex flex-col leading-none font-black text-[#0a1628] dark:text-slate-100">
              <span className="text-3xl">Aeyyyy</span>
              <span className="mt-1 text-sm tracking-[0.15em]">TRAVELLER&apos;S INN</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">Official Booking Receipt</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Generated {new Date().toLocaleString()}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-slate-400">Receipt No.</p>
            <p className="font-semibold text-[#0a1628] dark:text-slate-100">{booking.booking_code}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-slate-400">Status</p>
            <p className="font-semibold capitalize text-[#0a1628] dark:text-slate-100">
              {booking.status}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-slate-400">Guest Name</p>
            <p className="font-semibold text-[#0a1628] dark:text-slate-100">{booking.name}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-slate-400">Email</p>
            <p className="font-semibold text-[#0a1628] dark:text-slate-100">{booking.email}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-slate-400">Phone</p>
            <p className="font-semibold text-[#0a1628] dark:text-slate-100">
              {booking.phone || '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-slate-400">Room</p>
            <p className="font-semibold text-[#0a1628] dark:text-slate-100">
              {booking.destination}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-slate-400">Check-in</p>
            <p className="font-semibold text-[#0a1628] dark:text-slate-100">{booking.check_in}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-slate-400">Check-out</p>
            <p className="font-semibold text-[#0a1628] dark:text-slate-100">{booking.check_out}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-slate-400">Guests / Rooms</p>
            <p className="font-semibold text-[#0a1628] dark:text-slate-100">
              {booking.adults} adult(s)
              {(booking.children ?? 0) > 0 ? ` · ${booking.children} child(ren)` : ''}
              {' · '}
              {booking.rooms} room(s)
            </p>
          </div>
          {pricing && (
            <div>
              <p className="text-gray-500 dark:text-slate-400">Nights / Rate</p>
              <p className="font-semibold text-[#0a1628] dark:text-slate-100">
                {pricing.nights} night{pricing.nights === 1 ? '' : 's'}
                {pricing.rate > 0 ? ` · ${formatMoney(pricing.rate)} / night` : ''}
              </p>
            </div>
          )}
        </div>

        {booking.requests && (
          <div className="mt-6 rounded-[9px] bg-gray-50 p-4 text-sm dark:bg-slate-800/50">
            <p className="text-gray-500 dark:text-slate-400">Special Requests</p>
            <p className="mt-1 text-[#0a1628] dark:text-slate-100">{booking.requests}</p>
          </div>
        )}

        <div className="mt-8 border-t border-gray-200 pt-6 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-semibold text-[#0a1628] dark:text-slate-100">
            Payment summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-slate-400">Room stay</span>
              <span className="font-medium text-[#0a1628] dark:text-slate-100">
                {formatMoney(pricing?.stay ?? 0)}
              </span>
            </div>
            {pricing && pricing.charges.length > 0 && (
              <div className="space-y-1 border-t border-dashed border-gray-200 pt-2 dark:border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Other payables
                </p>
                {pricing.charges.map((charge) => (
                  <div key={charge.id} className="flex justify-between gap-4">
                    <span className="text-gray-500 dark:text-slate-400">{charge.label}</span>
                    <span className="font-medium text-[#0a1628] dark:text-slate-100">
                      {formatMoney(charge.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-gray-200 pt-2 dark:border-slate-700">
              <span className="font-semibold text-[#0a1628] dark:text-slate-100">Total due</span>
              <span className="text-xl font-bold text-[#0a1628] dark:text-slate-100">
                {formatMoney(pricing?.due ?? 0)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-slate-400">Amount paid</span>
              <span className="font-semibold text-emerald-600">
                {formatMoney(pricing?.paid ?? 0)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-slate-400">Amount unpaid</span>
              <span
                className={`font-semibold ${
                  (pricing?.unpaid ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {formatMoney(pricing?.unpaid ?? 0)}
              </span>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-gray-400 dark:text-slate-500">
            Thank you for choosing Aeyyyy Traveller&apos;s Inn.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          #receipt,
          #receipt * {
            visibility: visible !important;
          }
          #receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
