'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
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
import { toast } from 'sonner';

export default function BookingReceiptPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const cachedList = queryClient.getQueryData<Booking[]>(adminKeys.bookings);
  const cachedBooking = cachedList?.find((b) => b.id === params.id);

  const { data: fetchedBooking, isPending, error } = useBooking(params.id);
  const { data: rooms = [] } = useRooms();
  const [downloading, setDownloading] = useState(false);
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

  const downloadReceipt = async () => {
    const receipt = document.getElementById('receipt');
    if (!receipt) return;

    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(receipt, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#fffdf8',
      });
      const link = document.createElement('a');
      link.download = `Aeyyyy-receipt-${booking.booking_code}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Receipt downloaded');
    } catch (downloadError) {
      toast.error('Could not download receipt', {
        description:
          downloadError instanceof Error ? downloadError.message : undefined,
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-5 dark:bg-slate-950 sm:px-4 sm:py-8">
      <div className="mx-auto mb-3 flex max-w-2xl items-center justify-between gap-2 print:hidden sm:mb-4">
        <Link
          href="/admin/rooms?tab=bookings"
          prefetch
          className="inline-flex items-center text-sm text-[#0a1628] hover:underline dark:text-slate-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={downloading}
            onClick={() => void downloadReceipt()}
            className="inline-flex h-9 items-center rounded-[8px] bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:text-sm"
          >
            {downloading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Download
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center rounded-[8px] bg-[#0a1628] px-3 text-xs font-semibold text-white sm:text-sm"
          >
            <Printer className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Print / Save PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>

      <div
        id="receipt"
        className="receipt-paper relative mx-auto max-w-2xl overflow-hidden rounded-[6px] border border-slate-200 bg-[#fffdf8] p-5 text-slate-900 shadow-xl shadow-slate-300/30 sm:p-9"
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(135deg,#0f172a_0_10px,#f8fafc_10px_20px,#f59e0b_20px_30px,#f8fafc_30px_40px)]" />

        <div className="border-b-2 border-dashed border-slate-200 pb-5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="Aeyyyy Traveller's Inn"
              className="h-12 w-12 rounded-full object-cover ring-2 ring-amber-200 sm:h-14 sm:w-14"
            />
              <div className="flex flex-col font-black leading-none text-[#0a1628]">
                <span className="text-2xl sm:text-3xl">Aeyyyy</span>
                <span className="mt-1 text-[10px] tracking-[0.15em] sm:text-sm">
                  TRAVELLER&apos;S INN
                </span>
              </div>
            </div>
            <span
              className={`rotate-[-4deg] rounded-[5px] border-2 px-2 py-1 text-[10px] font-black uppercase tracking-wider sm:text-xs ${
                (pricing?.unpaid ?? 0) > 0
                  ? 'border-rose-500 text-rose-600'
                  : 'border-emerald-500 text-emerald-600'
              }`}
            >
              {(pricing?.unpaid ?? 0) > 0 ? 'Balance due' : 'Paid'}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">OFFICIAL BOOKING RECEIPT</p>
              <p className="receipt-muted text-[10px] text-slate-400">
                Generated {new Date().toLocaleString()}
              </p>
            </div>
            <p className="font-mono text-xs font-bold text-slate-700">
              #{booking.booking_code}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
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

        <div className="mt-6 border-t-2 border-dashed border-slate-200 pt-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#0a1628]">
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
            <div className="mt-2 flex items-end justify-between gap-4 border-y-2 border-dashed border-slate-300 bg-amber-50/60 px-2 py-3">
              <span className="font-semibold text-[#0a1628] dark:text-slate-100">Total due</span>
              <span className="text-2xl font-black tracking-tight text-[#0a1628]">
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
          <div className="mt-6 text-center">
            <p className="text-sm font-bold text-slate-700">
              Thank you for staying with us!
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Please keep this receipt for your records.
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        #receipt {
          color-scheme: light;
        }
        .dark #receipt [class*='dark:text-slate-100'] {
          color: #0f172a !important;
        }
        .dark #receipt [class*='dark:text-slate-400'],
        .dark #receipt [class*='dark:text-slate-500'] {
          color: #64748b !important;
        }
        .dark #receipt [class*='dark:border-slate-700'] {
          border-color: #e2e8f0 !important;
        }
        .dark #receipt [class*='dark:bg-slate-800'] {
          background-color: #f8fafc !important;
        }
        @media print {
          @page {
            size: auto;
            margin: 12mm;
          }
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
            border: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
