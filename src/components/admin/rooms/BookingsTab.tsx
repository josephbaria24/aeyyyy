'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Link2, Loader2, Receipt, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useBookings, useInvalidateAdmin, useRooms } from '@/lib/admin/queries';
import { formatMoney, SYSTEM_CURRENCY, SYSTEM_CURRENCY_SYMBOL } from '@/lib/money';
import {
  BOOKING_STATUS_LABEL,
  bookingGrandTotal,
  bookingUnpaid,
  type Booking,
  type BookingStatus,
} from '@/lib/types/booking';
import { StatusBadge } from '@/components/BookingStatusChecker';
import {
  BookingPaymentEditor,
  draftFromBooking,
  usePaymentDrafts,
} from '@/components/admin/rooms/BookingPaymentEditor';
import { ManualReservationDialog } from '@/components/admin/rooms/ManualReservationDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { adminEventsHref } from '@/lib/admin/events-hub';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logActivity } from '@/lib/admin/activity-log';

const EMPTY_BOOKINGS: Booking[] = [];

const statusToast: Record<BookingStatus, { title: string; type: 'success' | 'info' | 'error' }> = {
  pending: { title: 'Booking set to pending', type: 'info' },
  confirmed: { title: 'Booking confirmed', type: 'success' },
  declined: { title: 'Booking declined', type: 'error' },
  cancelled: { title: 'Booking cancelled', type: 'error' },
  rescheduled: { title: 'Booking marked rescheduled', type: 'info' },
};

const STATUS_ACTIONS: { status: BookingStatus; label: string }[] = [
  { status: 'confirmed', label: 'Confirm' },
  { status: 'declined', label: 'Decline' },
  { status: 'rescheduled', label: 'Reschedule' },
  { status: 'cancelled', label: 'Cancel' },
  { status: 'pending', label: 'Set pending' },
];

export function BookingsTab({
  guestEmail,
  focusBookingId,
  onClearGuestFilter,
}: {
  guestEmail?: string | null;
  focusBookingId?: string | null;
  onClearGuestFilter?: () => void;
}) {
  const { data, isPending, error: queryError } = useBookings();
  const roomsQuery = useRooms();
  const bookings = data ?? EMPTY_BOOKINGS;
  const rooms = roomsQuery.data ?? [];
  const invalidate = useInvalidateAdmin();
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { drafts, setDrafts, ensureDraft } = usePaymentDrafts(bookings, rooms);

  const guestKey = guestEmail?.trim().toLowerCase() || '';

  const filtered = useMemo(() => {
    if (!guestKey) return bookings;
    return bookings.filter((b) => b.email.toLowerCase() === guestKey);
  }, [bookings, guestKey]);

  const guestName = filtered[0]?.name;

  useEffect(() => {
    if (!focusBookingId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`booking-row-${focusBookingId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => window.clearTimeout(t);
  }, [focusBookingId, filtered]);

  const updateStatus = async (id: string, status: BookingStatus) => {
    setUpdatingId(id);
    setError('');
    const booking = bookings.find((b) => b.id === id);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.from('bookings').update({ status }).eq('id', id);
      if (updateError) throw updateError;

      if (status === 'confirmed' && booking) {
        const paid = Number(booking.amount_paid) || 0;
        const due = bookingGrandTotal(booking);
        const incomeAmount = paid > 0 ? paid : due;
        if (incomeAmount > 0) {
          await supabase.from('income').insert({
            title: `Booking ${booking.booking_code} — ${booking.name}`,
            category: 'booking',
            amount: incomeAmount,
            currency: booking.currency || SYSTEM_CURRENCY,
            income_date: new Date().toISOString().slice(0, 10),
            booking_id: booking.id,
            notes: `${booking.destination} (${booking.check_in} to ${booking.check_out}) · paid ${formatMoney(paid)} / due ${formatMoney(due)}`,
          });
          await invalidate(['bookings', 'income', 'activity']);
        } else {
          await invalidate(['bookings', 'activity']);
        }
      } else {
        await invalidate(['bookings', 'activity']);
      }

      await logActivity({
        action: 'status_changed',
        entity: 'booking',
        entityId: id,
        summary: `Set booking ${booking?.booking_code ?? id} to ${status}`,
        details: { from: booking?.status, to: status },
      });

      const meta = statusToast[status];
      const description = booking
        ? `${booking.booking_code} · ${booking.name}`
        : undefined;
      if (meta.type === 'success') toast.success(meta.title, { description });
      else if (meta.type === 'error') toast.error(meta.title, { description });
      else toast.info(meta.title, { description });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update booking';
      setError(message);
      toast.error('Status update failed', { description: message });
    } finally {
      setUpdatingId(null);
    }
  };

  const savePayments = async (booking: Booking) => {
    setUpdatingId(booking.id);
    setError('');
    try {
      const draft = ensureDraft(booking);
      const rate_per_night = Number(draft.rate_per_night) || 0;
      const amount = Number(draft.amount) || 0;
      const amount_paid = Number(draft.amount_paid) || 0;
      const other_charges = draft.other_charges
        .map((c) => ({
          id: c.id,
          label: c.label.trim() || 'Other charge',
          amount: Number(c.amount) || 0,
        }))
        .filter((c) => c.amount > 0 || c.label !== 'Other charge');

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ rate_per_night, amount, amount_paid, other_charges })
        .eq('id', booking.id);
      if (updateError) throw updateError;

      const saved = {
        ...booking,
        rate_per_night,
        amount,
        amount_paid,
        other_charges,
      };
      setDrafts((prev) => ({
        ...prev,
        [booking.id]: draftFromBooking(saved, rooms),
      }));
      await logActivity({
        action: 'updated',
        entity: 'booking',
        entityId: booking.id,
        summary: `Updated payments for booking ${booking.booking_code}`,
        details: { amount, amount_paid, rate_per_night },
      });
      await invalidate(['bookings', 'activity']);
      toast.success('Payments saved', {
        description: `Due ${formatMoney(bookingGrandTotal(saved))} · Unpaid ${formatMoney(bookingUnpaid(saved))}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save payments';
      setError(message);
      toast.error('Could not save payments', { description: message });
    } finally {
      setUpdatingId(null);
    }
  };

  const displayError = error || queryError?.message || '';

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0a1628] dark:text-slate-100">
            Reservations
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Manage online requests and reservations received in person or by phone.
          </p>
        </div>
        <ManualReservationDialog rooms={rooms} bookings={bookings} />
      </div>

      {guestKey && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[9px] admin-hairline bg-white px-4 py-3 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Showing bookings for{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {guestName || guestEmail}
            </span>
            <span className="ml-1 text-slate-400">({guestEmail})</span>
          </p>
          {onClearGuestFilter && (
            <button
              type="button"
              onClick={onClearGuestFilter}
              className="inline-flex items-center gap-1 rounded-[5px] bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-3 w-3" /> Clear filter
            </button>
          )}
        </div>
      )}

      {displayError && (
        <div className="mb-4 rounded-[9px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {displayError}
          {/column .* does not exist/i.test(displayError) && (
            <span className="mt-1 block text-xs">
              Tip: run <code>supabase/bookings-migrate-payments.sql</code> in the Supabase SQL
              Editor.
            </span>
          )}
        </div>
      )}

      {isPending && bookings.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0a1628] dark:text-slate-100" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3">Code</th>
                  <th className="px-3 py-3">Guest</th>
                  <th className="px-3 py-3">Room / Dates</th>
                  <th className="px-3 py-3">Payments ({SYSTEM_CURRENCY_SYMBOL})</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => {
                  const unpaid = bookingUnpaid(booking);
                  return (
                    <tr
                      key={booking.id}
                      id={`booking-row-${booking.id}`}
                      className={cn(
                        'border-b border-gray-50 align-middle dark:border-slate-800',
                        focusBookingId === booking.id &&
                          'bg-amber-50/80 dark:bg-amber-950/30',
                      )}
                    >
                      <td className="px-3 py-3 font-medium">
                        <p>{booking.booking_code}</p>
                        {booking.linked_event_booking_id && (
                          <Link
                            href={adminEventsHref('bookings', {
                              booking: booking.linked_event_booking_id,
                            })}
                            className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 hover:bg-violet-200 dark:bg-violet-950/50 dark:text-violet-200"
                          >
                            <Link2 className="h-3 w-3" />
                            Event {booking.linked_event_code || 'linked'}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-[#0a1628] dark:text-slate-100">
                          {booking.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {booking.email}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-slate-300">
                        <p className="font-medium text-[#0a1628] dark:text-slate-100">
                          {booking.destination}
                        </p>
                        <p className="text-xs">
                          {booking.check_in} → {booking.check_out}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Due {formatMoney(bookingGrandTotal(booking))}
                          {unpaid > 0 ? ` · Unpaid ${formatMoney(unpaid)}` : ' · Paid'}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <BookingPaymentEditor
                          booking={booking}
                          rooms={rooms}
                          draft={ensureDraft(booking)}
                          onChange={(next) =>
                            setDrafts((prev) => ({ ...prev, [booking.id]: next }))
                          }
                          onSave={() => void savePayments(booking)}
                          saving={updatingId === booking.id}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              disabled={updatingId === booking.id}
                              className="inline-flex items-center gap-1 rounded-[7px] admin-hairline bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Manage
                              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs font-normal text-slate-500">
                              Now: {BOOKING_STATUS_LABEL[booking.status]}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {STATUS_ACTIONS.filter((a) => a.status !== booking.status).map(
                              (action) => (
                                <DropdownMenuItem
                                  key={action.status}
                                  disabled={updatingId === booking.id}
                                  onSelect={() => void updateStatus(booking.id, action.status)}
                                >
                                  {action.label}
                                </DropdownMenuItem>
                              ),
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/receipts/${booking.id}`} prefetch>
                                <Receipt className="mr-2 h-3.5 w-3.5" />
                                View receipt
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-gray-500 dark:text-slate-400"
                    >
                      {guestKey
                        ? 'No bookings found for this guest.'
                        : 'No bookings yet.'}
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
