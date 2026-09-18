'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ImagePlus, Link2, Loader2, Pencil, Receipt, Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useBookings, useInvalidateAdmin, useRooms } from '@/lib/admin/queries';
import { formatMoney, SYSTEM_CURRENCY_SYMBOL } from '@/lib/money';
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
import { EditRoomBookingDialog } from '@/components/admin/rooms/EditRoomBookingDialog';
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
import { syncBookingIncome } from '@/lib/admin/booking-income';
import { BookingEvidenceDialog } from '@/components/admin/rooms/BookingEvidenceDialog';

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

type BookingSort =
  | 'newest'
  | 'oldest'
  | 'checkin_soonest'
  | 'checkin_latest'
  | 'amount_high'
  | 'amount_low';

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [sort, setSort] = useState<BookingSort>('newest');
  const [evidenceBooking, setEvidenceBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const { drafts, setDrafts, ensureDraft } = usePaymentDrafts(bookings, rooms);

  const guestKey = guestEmail?.trim().toLowerCase() || '';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const next = bookings.filter((booking) => {
      if (guestKey && booking.email.toLowerCase() !== guestKey) return false;
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
      if (!term) return true;
      return [
        booking.booking_code,
        booking.name,
        booking.email,
        booking.destination,
        booking.check_in,
        booking.check_out,
      ].some((value) => String(value ?? '').toLowerCase().includes(term));
    });

    return [...next].sort((a, b) => {
      if (sort === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sort === 'checkin_soonest') return a.check_in.localeCompare(b.check_in);
      if (sort === 'checkin_latest') return b.check_in.localeCompare(a.check_in);
      if (sort === 'amount_high') return bookingGrandTotal(b) - bookingGrandTotal(a);
      if (sort === 'amount_low') return bookingGrandTotal(a) - bookingGrandTotal(b);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [bookings, guestKey, search, sort, statusFilter]);

  const guestName = bookings.find((booking) => booking.email.toLowerCase() === guestKey)?.name;

  useEffect(() => {
    if (!focusBookingId) return;
    const t = window.setTimeout(() => {
      const layout = window.matchMedia('(min-width: 768px)').matches ? 'desktop' : 'mobile';
      document
        .getElementById(`booking-row-${layout}-${focusBookingId}`)
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
        const incomeSync = await syncBookingIncome(supabase, booking, paid);
        if (incomeSync.changed) {
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
      const incomeSync = await syncBookingIncome(supabase, saved, amount_paid);
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
      await invalidate(
        incomeSync.changed
          ? ['bookings', 'income', 'activity']
          : ['bookings', 'activity'],
      );
      toast.success('Payments saved', {
        description: `${incomeSync.difference > 0 ? `${formatMoney(incomeSync.difference)} added to income · ` : ''}Due ${formatMoney(bookingGrandTotal(saved))} · Unpaid ${formatMoney(bookingUnpaid(saved))}`,
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

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-[11px] bg-slate-200/70 p-2 dark:bg-slate-800 sm:grid-cols-[minmax(0,1fr)_10rem_12rem]">
        <label className="relative col-span-2 min-w-0 sm:col-span-1">
          <span className="sr-only">Search bookings</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, guest, email or room…"
            className="h-9 w-full min-w-0 rounded-[8px] border-0 bg-white pl-9 pr-8 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-white/10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Clear booking search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        <label className="min-w-0">
          <span className="sr-only">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'all' | BookingStatus)
            }
            className="h-9 w-full min-w-0 rounded-[8px] border-0 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Sort bookings</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as BookingSort)}
            className="h-9 w-full min-w-0 rounded-[8px] border-0 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="newest">Newest added</option>
            <option value="oldest">Oldest added</option>
            <option value="checkin_soonest">Check-in soonest</option>
            <option value="checkin_latest">Check-in latest</option>
            <option value="amount_high">Amount: high to low</option>
            <option value="amount_low">Amount: low to high</option>
          </select>
        </label>
      </div>

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
          <div className="max-h-[70dvh] space-y-2 overflow-y-auto p-2 md:hidden">
            {filtered.map((booking) => {
              const unpaid = bookingUnpaid(booking);
              return (
                <article
                  key={booking.id}
                  id={`booking-row-mobile-${booking.id}`}
                  className={cn(
                    'overflow-hidden rounded-[10px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                    focusBookingId === booking.id &&
                      'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="max-w-[7rem] truncate rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {booking.booking_code}
                        </span>
                        {booking.linked_event_booking_id && (
                          <Link
                            href={adminEventsHref('bookings', {
                              booking: booking.linked_event_booking_id,
                            })}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            Event
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {booking.name}
                      </p>
                      <p className="max-w-[15rem] truncate text-[10px] text-slate-400">
                        {booking.email}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-3 border-y border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {booking.destination}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {booking.check_in} → {booking.check_out}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {formatMoney(bookingGrandTotal(booking))}
                      </p>
                      <p
                        className={cn(
                          'text-[10px] font-semibold',
                          unpaid > 0 ? 'text-amber-600' : 'text-emerald-600',
                        )}
                      >
                        {unpaid > 0 ? `${formatMoney(unpaid)} unpaid` : 'Paid'}
                      </p>
                    </div>
                  </div>

                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-600 marker:hidden dark:text-slate-300 [&::-webkit-details-marker]:hidden">
                      <span>
                        Payment details · Paid {formatMoney(booking.amount_paid)}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-slate-100 px-3 py-3 dark:border-slate-800">
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
                    </div>
                  </details>

                  <div className="flex justify-end border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={updatingId === booking.id}
                          className="inline-flex items-center gap-1 rounded-[7px] bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
                        >
                          Manage
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs font-normal text-slate-500">
                          Now: {BOOKING_STATUS_LABEL[booking.status]}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {STATUS_ACTIONS.filter((action) => action.status !== booking.status).map(
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
                        <DropdownMenuItem onSelect={() => setEditingBooking(booking)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEvidenceBooking(booking)}>
                          <ImagePlus className="mr-2 h-3.5 w-3.5" />
                          Attachments
                          {booking.evidence_urls.length > 0 && (
                            <span className="ml-auto text-[10px] text-slate-400">
                              {booking.evidence_urls.length}
                            </span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/receipts/${booking.id}`} prefetch>
                            <Receipt className="mr-2 h-3.5 w-3.5" />
                            View receipt
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {guestKey ? 'No bookings found for this guest.' : 'No bookings yet.'}
              </p>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                      id={`booking-row-desktop-${booking.id}`}
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
                            <DropdownMenuItem onSelect={() => setEditingBooking(booking)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit details
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setEvidenceBooking(booking)}>
                              <ImagePlus className="mr-2 h-3.5 w-3.5" />
                              Attachments
                              {booking.evidence_urls.length > 0 && (
                                <span className="ml-auto text-[10px] text-slate-400">
                                  {booking.evidence_urls.length}
                                </span>
                              )}
                            </DropdownMenuItem>
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
      <BookingEvidenceDialog
        booking={evidenceBooking}
        open={evidenceBooking != null}
        onOpenChange={(open) => {
          if (!open) setEvidenceBooking(null);
        }}
      />
      <EditRoomBookingDialog
        booking={editingBooking}
        bookings={bookings}
        rooms={rooms}
        open={editingBooking != null}
        onOpenChange={(open) => {
          if (!open) setEditingBooking(null);
        }}
      />
    </>
  );
}
