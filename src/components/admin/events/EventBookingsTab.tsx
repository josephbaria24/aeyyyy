'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, BedDouble, ChevronDown, Link2, Loader2, Paperclip, PartyPopper, Pencil, Plus, Search, Waves, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/admin/activity-log';
import {
  useBookings,
  useEventBookings,
  useInvalidateAdmin,
  useOfferings,
  useRooms,
} from '@/lib/admin/queries';
import { adminRoomsHref } from '@/lib/admin/rooms-hub';
import { adminEventsHref } from '@/lib/admin/events-hub';
import { adminPoolHref } from '@/lib/admin/pool-hub';
import { areaRangeConflicts } from '@/lib/event-status';
import { getStayAvailability } from '@/lib/room-status';
import type { EventOffering, OfferingCategory } from '@/lib/types/event-offering';
import {
  calculateStayAmount,
  formatMoney,
  nightsBetween,
  SYSTEM_CURRENCY,
} from '@/lib/money';
import {
  BOOKING_STATUS_LABEL,
  type Booking,
  type BookingStatus,
} from '@/lib/types/booking';
import {
  eventBookingUnpaid,
  makeEventBookingCode,
  type EventBooking,
} from '@/lib/types/event-booking';
import type { Room } from '@/lib/types/room';
import { StatusBadge } from '@/components/BookingStatusChecker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EventBookingAttachmentsDialog } from '@/components/admin/events/EventBookingAttachmentsDialog';

const STATUS_ACTIONS: { status: BookingStatus; label: string }[] = [
  { status: 'confirmed', label: 'Confirm' },
  { status: 'declined', label: 'Decline' },
  { status: 'rescheduled', label: 'Reschedule' },
  { status: 'cancelled', label: 'Cancel' },
  { status: 'pending', label: 'Set pending' },
];

const EMPTY: EventBooking[] = [];
type EventBookingSort = 'newest' | 'oldest' | 'event_soonest' | 'event_latest';

function formatPaymentDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

export function EventBookingsTab({
  focusBookingId,
  category = 'event',
}: {
  focusBookingId?: string | null;
  category?: OfferingCategory;
}) {
  const bookingsQuery = useEventBookings();
  const offeringsQuery = useOfferings();
  const roomsQuery = useRooms();
  const roomBookingsQuery = useBookings();
  const invalidate = useInvalidateAdmin();
  const allBookings = bookingsQuery.data ?? EMPTY;
  const allOfferings = offeringsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const roomBookings = roomBookingsQuery.data ?? [];
  const offerings = useMemo(
    () => allOfferings.filter((item) => item.category === category),
    [allOfferings, category],
  );
  const bookings = useMemo(() => {
    const catById = new Map(allOfferings.map((o) => [o.id, o.category]));
    return allBookings.filter(
      (booking) => (catById.get(booking.offering_id ?? '') ?? 'event') === category,
    );
  }, [allBookings, allOfferings, category]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<EventBookingSort>('newest');
  const [editingBooking, setEditingBooking] = useState<EventBooking | null>(null);
  const [attachmentBooking, setAttachmentBooking] = useState<EventBooking | null>(null);
  const [transferBooking, setTransferBooking] = useState<EventBooking | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bookings
      .filter((booking) => {
        if (filter !== 'all' && booking.status !== filter) return false;
        if (!term) return true;
        return [
          booking.booking_code,
          booking.name,
          booking.email,
          booking.phone,
          booking.event_title,
          booking.requests,
        ].some((value) => value?.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        if (sort === 'oldest') return a.created_at.localeCompare(b.created_at);
        if (sort === 'event_soonest') {
          return (a.event_date || '9999-12-31').localeCompare(b.event_date || '9999-12-31');
        }
        if (sort === 'event_latest') {
          return (b.event_date || '').localeCompare(a.event_date || '');
        }
        return b.created_at.localeCompare(a.created_at);
      });
  }, [bookings, filter, search, sort]);

  useEffect(() => {
    if (!focusBookingId) return;
    const view = window.matchMedia('(min-width: 768px)').matches ? 'desktop' : 'mobile';
    const el = document.getElementById(`event-booking-${view}-${focusBookingId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusBookingId, filtered]);

  const updateStatus = async (booking: EventBooking, status: BookingStatus) => {
    setUpdatingId(booking.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('event_bookings')
        .update({ status })
        .eq('id', booking.id);
      if (error) throw error;

      if (status === 'confirmed') {
        const recordedPayments = booking.payment_history.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        );
        const incomeAmount = Math.max(
          0,
          (Number(booking.amount_paid) > 0
            ? Number(booking.amount_paid)
            : Number(booking.amount) || 0) - recordedPayments,
        );
        if (incomeAmount > 0) {
          const kind = category === 'pool' ? 'Pool' : 'Event';
          await supabase.from('income').insert({
            title: `${kind} ${booking.booking_code} — ${booking.name}`,
            category: 'booking',
            amount: incomeAmount,
            currency: booking.currency || SYSTEM_CURRENCY,
            income_date: booking.event_date || new Date().toISOString().slice(0, 10),
            notes: `${booking.event_title} · ${booking.guests} guest${booking.guests === 1 ? '' : 's'}`,
          });
        }
      }

      await logActivity({
        action: 'status_changed',
        entity: 'event_booking',
        entityId: booking.id,
        summary: `Set event booking ${booking.booking_code} to ${status}`,
        details: { from: booking.status, to: status },
      });
      await invalidate(
        status === 'confirmed' ? ['eventBookings', 'income', 'activity'] : ['eventBookings', 'activity'],
      );
      toast.success(`Booking ${BOOKING_STATUS_LABEL[status].toLowerCase()}`, {
        description: `${booking.booking_code} · ${booking.name}`,
      });
    } catch (err) {
      toast.error('Could not update status', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const savePayment = async (booking: EventBooking, paymentAmount: number) => {
    if (paymentAmount <= 0) {
      toast.error('Enter a payment amount greater than zero');
      return false;
    }
    const unpaid = eventBookingUnpaid(booking);
    if (paymentAmount > unpaid) {
      toast.error('Payment is higher than the remaining balance', {
        description: `Remaining balance: ${formatMoney(unpaid)}`,
      });
      return false;
    }

    setUpdatingId(booking.id);
    try {
      const supabase = createClient();
      const payment = {
        id: crypto.randomUUID(),
        amount: paymentAmount,
        paid_at: new Date().toISOString(),
      };
      const amountPaid = Number(booking.amount_paid) + paymentAmount;
      const paymentHistory = [...booking.payment_history, payment];
      const { error } = await supabase
        .from('event_bookings')
        .update({ amount_paid: amountPaid, payment_history: paymentHistory })
        .eq('id', booking.id);
      if (error) throw error;

      const { error: incomeError } = await supabase.from('income').insert({
        title: `${category === 'pool' ? 'Pool' : 'Event'} payment ${booking.booking_code} — ${booking.name}`,
        category: 'booking',
        amount: paymentAmount,
        currency: booking.currency || SYSTEM_CURRENCY,
        income_date: booking.event_date || new Date().toISOString().slice(0, 10),
        notes: `${booking.event_title} · ${booking.guests} guest${booking.guests === 1 ? '' : 's'} · installment payment`,
      });
      if (incomeError) throw incomeError;

      await logActivity({
        action: 'updated',
        entity: 'event_booking',
        entityId: booking.id,
        summary: `Added payment for ${booking.booking_code}`,
        details: { payment_amount: paymentAmount, amount_paid: amountPaid },
      });
      await invalidate(['eventBookings', 'income', 'activity']);
      toast.success('Payment added', {
        description: `${formatMoney(paymentAmount)} received · ${formatMoney(amountPaid)} paid in total`,
      });
      return true;
    } catch (err) {
      toast.error('Could not save payment', {
        description:
          err instanceof Error
            ? `${err.message} — run supabase/event-booking-payments.sql if needed.`
            : undefined,
      });
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {category === 'pool' ? 'Pool bookings' : 'Event bookings'}
          </h2>
          <p className="text-sm text-slate-500">
            {category === 'pool'
              ? 'Day-use swimming reservations — confirm, pay, or reschedule.'
              : 'Reservations for inn areas — confirm, pay, or reschedule.'}
          </p>
        </div>
        <ManualEventReservation
          category={category}
          offerings={offerings.filter((o) => o.is_active)}
          bookings={bookings}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-[11px] bg-slate-200/70 p-2 dark:bg-slate-800 sm:grid-cols-[minmax(0,1fr)_10rem_11rem]">
        <label className="relative col-span-2 min-w-0 sm:col-span-1">
          <span className="sr-only">
            Search {category === 'pool' ? 'pool' : 'event'} bookings
          </span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, guest, email or area…"
            className="h-9 w-full min-w-0 rounded-[8px] border-0 bg-white pl-9 pr-8 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-white/10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Clear event booking search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        <label className="min-w-0">
          <span className="sr-only">Filter by status</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as 'all' | BookingStatus)}
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
          <span className="sr-only">Sort event bookings</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as EventBookingSort)}
            className="h-9 w-full min-w-0 rounded-[8px] border-0 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="newest">Newest added</option>
            <option value="oldest">Oldest added</option>
            <option value="event_soonest">Event soonest</option>
            <option value="event_latest">Event latest</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
        {bookingsQuery.isPending && !bookings.length ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : (
          <>
            <div className="max-h-[70dvh] space-y-2 overflow-y-auto p-2 md:hidden">
              {filtered.map((booking) => (
                <EventBookingCard
                  key={booking.id}
                  booking={booking}
                  focused={booking.id === focusBookingId}
                  updating={updatingId === booking.id}
                  onStatus={(status) => void updateStatus(booking, status)}
                  onSavePaid={(paid) => savePayment(booking, paid)}
                  onEdit={() => setEditingBooking(booking)}
                  onTransfer={() => setTransferBooking(booking)}
                  onAttachments={() => setAttachmentBooking(booking)}
                />
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  No event bookings found.
                </p>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Guest</th>
                  <th className="px-3 py-2.5">Area</th>
                  <th className="px-3 py-2.5">Spots</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {filtered.map((booking) => (
                  <EventBookingRow
                    key={booking.id}
                    booking={booking}
                    focused={booking.id === focusBookingId}
                    updating={updatingId === booking.id}
                    onStatus={(status) => void updateStatus(booking, status)}
                    onSavePaid={(paid) => savePayment(booking, paid)}
                    onEdit={() => setEditingBooking(booking)}
                    onTransfer={() => setTransferBooking(booking)}
                    onAttachments={() => setAttachmentBooking(booking)}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No event bookings yet.
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <EditEventBookingDialog
        booking={editingBooking}
        bookings={bookings}
        offerings={offerings}
        open={editingBooking != null}
        onOpenChange={(next) => {
          if (!next) setEditingBooking(null);
        }}
      />
      <TransferBookingDialog
        booking={transferBooking}
        eventBookings={allBookings}
        offerings={allOfferings}
        rooms={rooms}
        roomBookings={roomBookings}
        fromCategory={category}
        open={transferBooking != null}
        onOpenChange={(next) => {
          if (!next) setTransferBooking(null);
        }}
      />
      <EventBookingAttachmentsDialog
        booking={attachmentBooking}
        open={attachmentBooking != null}
        onOpenChange={(next) => {
          if (!next) setAttachmentBooking(null);
        }}
      />
    </div>
  );
}

function EventBookingCard({
  booking,
  focused,
  updating,
  onStatus,
  onSavePaid,
  onEdit,
  onTransfer,
  onAttachments,
}: {
  booking: EventBooking;
  focused: boolean;
  updating: boolean;
  onStatus: (status: BookingStatus) => void;
  onSavePaid: (amount: number) => Promise<boolean>;
  onEdit: () => void;
  onTransfer: () => void;
  onAttachments: () => void;
}) {
  const [paid, setPaid] = useState('');
  const unpaid = eventBookingUnpaid(booking);
  const eventDates = booking.event_date
    ? `${booking.event_date}${
        booking.event_end_date && booking.event_end_date !== booking.event_date
          ? ` → ${booking.event_end_date}`
          : ''
      }`
    : 'No date';

  return (
    <article
      id={`event-booking-mobile-${booking.id}`}
      className={cn(
        'overflow-hidden rounded-[11px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        focused && 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/20',
      )}
    >
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-mono text-[11px] font-bold text-slate-500">
              {booking.booking_code}
            </p>
            {booking.linked_room_booking_id && (
              <Link
                href={adminRoomsHref('bookings', { booking: booking.linked_room_booking_id })}
                className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
              >
                <Link2 className="h-2.5 w-2.5" />
                Room {booking.linked_room_code || 'linked'}
              </Link>
            )}
          </div>
          <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
            {booking.name}
          </p>
          <p className="truncate text-[10px] text-slate-400">{booking.email}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-y border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/30">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
            {booking.event_title}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {eventDates}
            {booking.start_time || booking.end_time
              ? ` · ${[booking.start_time, booking.end_time].filter(Boolean).join('–')}`
              : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(booking.amount)}
          </p>
          <p className={cn('text-[10px] font-semibold', unpaid > 0 ? 'text-amber-600' : 'text-emerald-600')}>
            {unpaid > 0 ? `${formatMoney(unpaid)} unpaid` : 'Paid'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          {booking.guests} guest{booking.guests === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-slate-500">Add</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
              aria-label={`Amount paid for ${booking.booking_code}`}
              placeholder="Payment"
              className="h-7 w-20 rounded-[7px] admin-hairline bg-white px-2 text-[11px] dark:bg-slate-950"
            />
          </label>
          <button
            type="button"
            disabled={updating}
            onClick={() => {
              void onSavePaid(Number(paid) || 0).then((saved) => {
                if (saved) setPaid('');
              });
            }}
            className="h-7 rounded-[7px] bg-emerald-600 px-2 text-[10px] font-bold text-white disabled:opacity-60"
          >
            Pay
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={updating}
                className="grid h-7 w-7 place-items-center rounded-[7px] bg-slate-900 text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
                aria-label={`Manage ${booking.booking_code}`}
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onTransfer}>
                <ArrowLeftRight className="mr-2 h-3.5 w-3.5" />
                Transfer
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAttachments}>
                <Paperclip className="mr-2 h-3.5 w-3.5" />
                Attachments
                {booking.attachment_urls.length > 0 && (
                  <span className="ml-auto text-[10px] text-slate-400">
                    {booking.attachment_urls.length}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_ACTIONS.map((action) => (
                <DropdownMenuItem key={action.status} onSelect={() => onStatus(action.status)}>
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <details className="group border-t border-slate-100 dark:border-slate-800">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] font-semibold text-slate-500 marker:hidden [&::-webkit-details-marker]:hidden">
          <span>
            Payment history · {booking.payment_history.length} installment
            {booking.payment_history.length === 1 ? '' : 's'} · {formatMoney(booking.amount_paid)} total
          </span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/30">
          {booking.payment_history.length ? (
            [...booking.payment_history].reverse().map((payment, index) => (
              <div
                key={payment.id || `${payment.paid_at}-${index}`}
                className="flex items-center justify-between gap-3 text-[10px]"
              >
                <span className="text-slate-500">{formatPaymentDate(payment.paid_at)}</span>
                <span className="font-bold text-emerald-600">+{formatMoney(payment.amount)}</span>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-slate-400">
              No installment records yet. Existing paid totals are still preserved.
            </p>
          )}
        </div>
      </details>
    </article>
  );
}

function EventBookingRow({
  booking,
  focused,
  updating,
  onStatus,
  onSavePaid,
  onEdit,
  onTransfer,
  onAttachments,
}: {
  booking: EventBooking;
  focused: boolean;
  updating: boolean;
  onStatus: (status: BookingStatus) => void;
  onSavePaid: (amount: number) => Promise<boolean>;
  onEdit: () => void;
  onTransfer: () => void;
  onAttachments: () => void;
}) {
  const [paid, setPaid] = useState('');
  const unpaid = eventBookingUnpaid(booking);

  return (
    <tr
      id={`event-booking-desktop-${booking.id}`}
      className={cn('align-top', focused && 'bg-amber-50/80 dark:bg-amber-950/30')}
    >
      <td className="px-3 py-3 font-medium">
        <p>{booking.booking_code}</p>
        {booking.linked_room_booking_id && (
          <Link
            href={adminRoomsHref('bookings', { booking: booking.linked_room_booking_id })}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-200"
          >
            <Link2 className="h-3 w-3" />
            Room {booking.linked_room_code || 'linked'}
          </Link>
        )}
      </td>
      <td className="px-3 py-3">
        <p className="font-medium text-slate-900 dark:text-slate-100">{booking.name}</p>
        <p className="text-xs text-slate-500">{booking.email}</p>
      </td>
      <td className="px-3 py-3">
        <p>{booking.event_title}</p>
        <p className="text-xs text-slate-500">
          {booking.event_date
            ? `${booking.event_date}${
                booking.event_end_date && booking.event_end_date !== booking.event_date
                  ? ` → ${booking.event_end_date}`
                  : ''
              }${
                booking.start_time || booking.end_time
                  ? ` · ${[booking.start_time, booking.end_time].filter(Boolean).join('–')}`
                  : ''
              }`
            : 'No date'}
        </p>
        {booking.requests && (
          <p className="mt-1 text-xs text-slate-400">Occasion / notes: {booking.requests}</p>
        )}
      </td>
      <td className="px-3 py-3">{booking.guests}</td>
      <td className="px-3 py-3">
        <p>{formatMoney(booking.amount)}</p>
        <p className="text-xs text-slate-500">
          Paid {formatMoney(booking.amount_paid)}
          {unpaid > 0 ? ` · unpaid ${formatMoney(unpaid)}` : ''}
        </p>
        <div className="mt-1 flex gap-1">
          <input
            type="number"
            min={0}
            step="0.01"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            placeholder="Add payment"
            aria-label={`Add payment for ${booking.booking_code}`}
            className="w-24 rounded-[7px] admin-hairline px-2 py-1 text-xs dark:bg-slate-950"
          />
          <button
            type="button"
            disabled={updating}
            onClick={() => {
              void onSavePaid(Number(paid) || 0).then((saved) => {
                if (saved) setPaid('');
              });
            }}
            className="rounded-[7px] bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Add
          </button>
        </div>
        {booking.payment_history.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-[10px] font-semibold text-slate-500">
              History ({booking.payment_history.length})
            </summary>
            <div className="mt-1 space-y-0.5">
              {[...booking.payment_history].reverse().map((payment, index) => (
                <p
                  key={payment.id || `${payment.paid_at}-${index}`}
                  className="text-[10px] text-slate-500"
                >
                  +{formatMoney(payment.amount)} · {formatPaymentDate(payment.paid_at)}
                </p>
              ))}
            </div>
          </details>
        )}
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={booking.status} />
      </td>
      <td className="px-3 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={updating}
              className="inline-flex items-center gap-1 rounded-[8px] admin-hairline px-2.5 py-1.5 text-xs font-semibold"
            >
              {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Actions'}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onTransfer}>
              <ArrowLeftRight className="mr-2 h-3.5 w-3.5" />
              Transfer
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAttachments}>
              <Paperclip className="mr-2 h-3.5 w-3.5" />
              Attachments
              {booking.attachment_urls.length > 0 && (
                <span className="ml-auto text-[10px] text-slate-400">
                  {booking.attachment_urls.length}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_ACTIONS.map((action) => (
              <DropdownMenuItem key={action.status} onSelect={() => onStatus(action.status)}>
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

type TransferDestination = 'pool' | 'event' | 'room';

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function walkInRoomCode() {
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `WI${time}${random}`;
}

function TransferBookingDialog({
  booking,
  eventBookings,
  offerings,
  rooms,
  roomBookings,
  fromCategory,
  open,
  onOpenChange,
}: {
  booking: EventBooking | null;
  eventBookings: EventBooking[];
  offerings: EventOffering[];
  rooms: Room[];
  roomBookings: Booking[];
  fromCategory: OfferingCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const invalidate = useInvalidateAdmin();
  const [saving, setSaving] = useState(false);
  const [destination, setDestination] = useState<TransferDestination | null>(null);
  const [offeringId, setOfferingId] = useState('');
  const [keepPrice, setKeepPrice] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [roomName, setRoomName] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const [rate, setRate] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');

  const destinationOptions = useMemo(() => {
    const options: {
      id: TransferDestination;
      label: string;
      hint: string;
      icon: typeof Waves;
    }[] = [];
    if (fromCategory !== 'pool') {
      options.push({
        id: 'pool',
        label: 'Pool',
        hint: 'Day-use swim package',
        icon: Waves,
      });
    }
    if (fromCategory !== 'event') {
      options.push({
        id: 'event',
        label: 'Event',
        hint: 'Celebration area booking',
        icon: PartyPopper,
      });
    }
    options.push({
      id: 'room',
      label: 'Room',
      hint: 'Overnight room stay',
      icon: BedDouble,
    });
    return options;
  }, [fromCategory]);

  const offeringTargets = useMemo(() => {
    if (destination !== 'pool' && destination !== 'event') return [];
    return offerings
      .filter((item) => item.category === destination && item.is_active)
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  }, [destination, offerings]);

  useEffect(() => {
    if (!open || !booking) return;
    setDestination(null);
    setOfferingId('');
    setKeepPrice(true);
    setStartDate(booking.event_date ?? '');
    setEndDate(booking.event_end_date || booking.event_date || '');
    setRoomName(rooms[0]?.name ?? '');
    setCheckIn(booking.event_date ?? '');
    setCheckOut(
      booking.event_end_date || booking.event_date
        ? addDaysIso(booking.event_end_date || booking.event_date!, 1)
        : '',
    );
    setAdults(String(Math.max(1, booking.guests || 1)));
    setChildren('0');
    setRate(rooms[0] ? String(rooms[0].price_per_night) : '');
    setAmountPaid(String(booking.amount_paid || 0));
  }, [open, booking, rooms]);

  useEffect(() => {
    if (!destination || destination === 'room') return;
    setOfferingId(offeringTargets[0]?.id ?? '');
  }, [destination, offeringTargets]);

  const selectedOffering =
    offeringTargets.find((item) => item.id === offeringId) ?? offeringTargets[0] ?? null;
  const selectedRoom = rooms.find((room) => room.name === roomName) ?? null;

  const confirmedStays = useMemo(
    () =>
      roomBookings
        .filter((item) => item.status === 'confirmed')
        .map((item) => ({
          destination: item.destination,
          check_in: item.check_in,
          check_out: item.check_out,
        })),
    [roomBookings],
  );

  const roomAvailability = useMemo(
    () => getStayAvailability(selectedRoom, confirmedStays, checkIn, checkOut),
    [selectedRoom, confirmedStays, checkIn, checkOut],
  );

  const roomNights = nightsBetween(checkIn, checkOut);
  const roomStayTotal = calculateStayAmount(Number(rate) || 0, checkIn, checkOut, 1);
  const needsDates =
    destination === 'pool' || destination === 'event'
      ? !booking?.event_date
      : false;

  const chooseRoom = (name: string) => {
    const room = rooms.find((item) => item.name === name);
    setRoomName(name);
    if (room) setRate(String(room.price_per_night));
  };

  const transferToOffering = async () => {
    if (!booking || !selectedOffering || (destination !== 'pool' && destination !== 'event')) {
      toast.error('Choose a destination package');
      return;
    }
    if (selectedOffering.availability === 'unavailable') {
      toast.error('That package is marked unavailable');
      return;
    }
    const start = needsDates ? startDate : booking.event_date;
    const end = needsDates ? endDate || startDate : booking.event_end_date || booking.event_date;
    if (!start || !end || end < start) {
      toast.error('Choose a valid date range');
      return;
    }
    if (
      areaRangeConflicts(
        eventBookings.filter((item) => item.id !== booking.id),
        selectedOffering.id,
        start,
        end,
      )
    ) {
      toast.error(`Those dates are already reserved for “${selectedOffering.title}”`);
      return;
    }

    const nextAmount = keepPrice
      ? Number(booking.amount) || 0
      : (Number(selectedOffering.price) || 0) * Math.max(1, Number(booking.guests) || 1);
    if (nextAmount < Number(booking.amount_paid)) {
      toast.error('New price cannot be lower than the amount already paid', {
        description: `${formatMoney(booking.amount_paid)} has already been paid.`,
      });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('event_bookings')
        .update({
          offering_id: selectedOffering.id,
          event_title: selectedOffering.title,
          event_date: start,
          event_end_date: end,
          amount: nextAmount,
        })
        .eq('id', booking.id);
      if (error) throw error;

      await logActivity({
        action: 'updated',
        entity: 'event_booking',
        entityId: booking.id,
        summary: `Transferred ${booking.booking_code} to ${destination} “${selectedOffering.title}”`,
        details: {
          from_title: booking.event_title,
          to_offering_id: selectedOffering.id,
          to_category: destination,
        },
      });
      await invalidate(['eventBookings', 'activity']);
      onOpenChange(false);
      toast.success(`Moved to ${destination}`, {
        description: `${booking.booking_code} · ${selectedOffering.title}`,
        action: {
          label: destination === 'pool' ? 'Open Pool' : 'Open Events',
          onClick: () => {
            router.push(
              destination === 'pool'
                ? adminPoolHref('bookings', { booking: booking.id })
                : adminEventsHref('bookings', { booking: booking.id }),
            );
          },
        },
      });
    } catch (err) {
      toast.error('Could not transfer booking', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const transferToRoom = async () => {
    if (!booking) return;
    if (!selectedRoom) {
      toast.error('Choose a room');
      return;
    }
    if (!checkIn || !checkOut || roomNights < 1) {
      toast.error('Check-out must be after check-in');
      return;
    }
    if (roomAvailability.kind === 'unavailable') {
      toast.error('This room is marked unavailable');
      return;
    }
    if (roomAvailability.kind === 'conflict') {
      toast.error('This room already has a confirmed stay on those dates');
      return;
    }

    const paid = Math.max(0, Number(amountPaid) || 0);
    if (paid > roomStayTotal) {
      toast.error('Amount paid cannot exceed the stay total');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const code = walkInRoomCode();
      const { data: inserted, error } = await supabase
        .from('bookings')
        .insert({
          booking_code: code,
          name: booking.name,
          email: booking.email || 'walk-in@aeyyyy.local',
          phone: booking.phone,
          destination: selectedRoom.name,
          check_in: checkIn,
          check_out: checkOut,
          adults: Math.max(1, Number(adults) || 1),
          children: Math.max(0, Number(children) || 0),
          rooms: 1,
          requests: booking.requests,
          status: 'confirmed',
          rate_per_night: Number(rate) || 0,
          amount: roomStayTotal,
          amount_paid: paid,
          other_charges: [],
          evidence_urls: [],
          currency: booking.currency || SYSTEM_CURRENCY,
          notes: `Transferred from ${booking.booking_code} (${booking.event_title})`,
          linked_event_booking_id: booking.id,
          linked_event_code: booking.booking_code,
        })
        .select('id, booking_code')
        .single();
      if (error) throw error;

      const { error: eventError } = await supabase
        .from('event_bookings')
        .update({
          status: 'cancelled',
          linked_room_booking_id: inserted.id,
          linked_room_code: inserted.booking_code,
          notes: [booking.notes, `Transferred to room ${inserted.booking_code}`]
            .filter(Boolean)
            .join(' · '),
        })
        .eq('id', booking.id);
      if (eventError) throw eventError;

      if (paid > 0) {
        await supabase.from('income').insert({
          title: `Booking ${inserted.booking_code} — ${booking.name}`,
          category: 'booking',
          amount: paid,
          currency: booking.currency || SYSTEM_CURRENCY,
          income_date: checkIn,
          booking_id: inserted.id,
          notes: `${selectedRoom.name} (${checkIn} to ${checkOut}) · transferred from ${booking.booking_code} · ${Math.max(1, Number(adults) || 1) + Math.max(0, Number(children) || 0)} guests`,
        });
      }

      await logActivity({
        action: 'updated',
        entity: 'event_booking',
        entityId: booking.id,
        summary: `Transferred ${booking.booking_code} to room booking ${inserted.booking_code}`,
        details: { room_booking_id: inserted.id, room: selectedRoom.name },
      });
      await invalidate(['eventBookings', 'bookings', 'income', 'activity']);
      onOpenChange(false);
      toast.success('Moved to room booking', {
        description: `${inserted.booking_code} · ${selectedRoom.name}`,
        action: {
          label: 'Open Rooms',
          onClick: () => {
            router.push(adminRoomsHref('bookings', { booking: inserted.id }));
          },
        },
      });
    } catch (err) {
      toast.error('Could not transfer to room', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!destination) {
      toast.error('Choose where to transfer');
      return;
    }
    if (destination === 'room') {
      await transferToRoom();
      return;
    }
    await transferToOffering();
  };

  const fieldClass =
    'w-full rounded-[9px] admin-hairline bg-white px-3 py-2.5 text-sm dark:bg-slate-950';

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-md dark:border-slate-800 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle>Transfer booking</DialogTitle>
          <DialogDescription>
            {booking
              ? `Move ${booking.booking_code} (${booking.event_title}) to another booking type.`
              : 'Choose a destination.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500">Transfer to</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {destinationOptions.map((option) => {
                const Icon = option.icon;
                const active = destination === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDestination(option.id)}
                    className={cn(
                      'rounded-[10px] border px-3 py-2.5 text-left transition',
                      active
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <p className="mt-1.5 text-sm font-bold">{option.label}</p>
                    <p
                      className={cn(
                        'mt-0.5 text-[10px] leading-snug',
                        active ? 'text-white/70 dark:text-slate-500' : 'text-slate-500',
                      )}
                    >
                      {option.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {destination === 'pool' || destination === 'event' ? (
            <div className="space-y-3 rounded-[11px] border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {destination === 'pool' ? 'Pool details' : 'Event details'}
              </p>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                  {destination === 'pool' ? 'Pool package' : 'Event area'}
                </span>
                <select
                  required
                  value={offeringId || selectedOffering?.id || ''}
                  onChange={(event) => setOfferingId(event.target.value)}
                  className={fieldClass}
                >
                  {offeringTargets.length === 0 && (
                    <option value="">
                      No {destination === 'pool' ? 'pool packages' : 'event areas'} yet
                    </option>
                  )}
                  {offeringTargets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.availability === 'unavailable' ? ' — unavailable' : ''}
                      {item.price > 0 ? ` · ${formatMoney(item.price)}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {needsDates && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Start date
                    </span>
                    <input
                      required
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                      End date
                    </span>
                    <input
                      required
                      type="date"
                      min={startDate}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                </div>
              )}

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={keepPrice}
                  onChange={(event) => setKeepPrice(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold">
                    Keep current price ({formatMoney(Number(booking?.amount) || 0)})
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Uncheck to use package rate × guests
                    {selectedOffering
                      ? ` (${formatMoney((Number(selectedOffering.price) || 0) * Math.max(1, Number(booking?.guests) || 1))})`
                      : ''}
                    .
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          {destination === 'room' ? (
            <div className="space-y-3 rounded-[11px] border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Room details</p>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">Room</span>
                <select
                  required
                  value={roomName}
                  onChange={(event) => chooseRoom(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Choose a room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.name}>
                      {room.name}
                      {room.availability === 'unavailable' ? ' — unavailable' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Check-in
                  </span>
                  <input
                    required
                    type="date"
                    value={checkIn}
                    onChange={(event) => setCheckIn(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Check-out
                  </span>
                  <input
                    required
                    type="date"
                    min={checkIn}
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Adults</span>
                  <input
                    required
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(event) => setAdults(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Children
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={children}
                    onChange={(event) => setChildren(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Rate / night
                  </span>
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Amount paid
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amountPaid}
                    onChange={(event) => setAmountPaid(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>
              <p className="rounded-[8px] bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
                Stay total:{' '}
                <span className="font-bold">
                  {roomNights > 0 ? formatMoney(roomStayTotal) : '—'}
                </span>
                {roomNights > 0 ? ` · ${roomNights} night${roomNights === 1 ? '' : 's'}` : ''}
              </p>
              {roomAvailability.kind === 'unavailable' && (
                <p className="text-xs text-rose-600">This room is marked unavailable.</p>
              )}
              {roomAvailability.kind === 'conflict' && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Conflicts with a confirmed stay from {roomAvailability.stay.check_in} to{' '}
                  {roomAvailability.stay.check_out}.
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                Guest name, email, and phone stay the same. The current booking will be cancelled
                and linked to the new room reservation.
              </p>
            </div>
          ) : null}

          <DialogFooter className="pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (destination) setDestination(null);
                else onOpenChange(false);
              }}
              className="rounded-[9px] admin-hairline px-4 py-2.5 text-sm font-semibold"
            >
              {destination ? 'Back' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                !destination ||
                ((destination === 'pool' || destination === 'event') &&
                  offeringTargets.length === 0) ||
                (destination === 'room' &&
                  (rooms.length === 0 ||
                    roomAvailability.kind === 'unavailable' ||
                    roomAvailability.kind === 'conflict'))
              }
              className="inline-flex items-center gap-2 rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Transferring…' : 'Transfer'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditEventBookingDialog({
  booking,
  bookings,
  offerings,
  open,
  onOpenChange,
}: {
  booking: EventBooking | null;
  bookings: EventBooking[];
  offerings: EventOffering[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useInvalidateAdmin();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    offeringId: '',
    name: '',
    email: '',
    phone: '',
    guests: '1',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    amount: '',
    requests: '',
    notes: '',
  });

  useEffect(() => {
    if (!booking || !open) return;
    setForm({
      offeringId: booking.offering_id ?? '',
      name: booking.name,
      email: booking.email,
      phone: booking.phone ?? '',
      guests: String(booking.guests),
      startDate: booking.event_date ?? '',
      endDate: booking.event_end_date ?? booking.event_date ?? '',
      startTime: booking.start_time ?? '',
      endTime: booking.end_time ?? '',
      amount: String(booking.amount),
      requests: booking.requests ?? '',
      notes: booking.notes ?? '',
    });
  }, [booking, open]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!booking) return;
    const selected = offerings.find((offering) => offering.id === form.offeringId);
    if (!selected) {
      toast.error('Choose an event area');
      return;
    }
    const endDate = form.endDate || form.startDate;
    if (!form.startDate || endDate < form.startDate) {
      toast.error('Choose a valid event date range');
      return;
    }
    if (
      areaRangeConflicts(
        bookings.filter((item) => item.id !== booking.id),
        selected.id,
        form.startDate,
        endDate,
      )
    ) {
      toast.error('That date range is already reserved for this area');
      return;
    }
    const amount = Math.max(0, Number(form.amount) || 0);
    if (amount < Number(booking.amount_paid)) {
      toast.error('Price cannot be lower than the amount already paid', {
        description: `${formatMoney(booking.amount_paid)} has already been paid.`,
      });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('event_bookings')
        .update({
          offering_id: selected.id,
          event_title: selected.title,
          event_date: form.startDate,
          event_end_date: endDate,
          start_time: form.startTime || null,
          end_time: form.endTime || null,
          name: form.name.trim(),
          email: form.email.trim() || 'walk-in@aeyyyy.local',
          phone: form.phone.trim() || null,
          guests: Math.max(1, Number(form.guests) || 1),
          amount,
          requests: form.requests.trim() || null,
          notes: form.notes.trim() || null,
        })
        .eq('id', booking.id);
      if (error) throw error;

      // Keep generated event income in the same accounting month as the event.
      await supabase
        .from('income')
        .update({ income_date: form.startDate })
        .ilike('title', `%${booking.booking_code}%`);

      await logActivity({
        action: 'updated',
        entity: 'event_booking',
        entityId: booking.id,
        summary: `Edited event booking ${booking.booking_code}`,
        details: {
          area: selected.title,
          event_date: form.startDate,
          event_end_date: endDate,
          amount,
        },
      });
      await invalidate(['eventBookings', 'income', 'activity']);
      toast.success('Event booking updated');
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not update event booking', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const editField =
    'mt-1 w-full min-w-0 rounded-[9px] admin-hairline bg-white px-3 py-2 text-sm dark:bg-slate-950';

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit event booking</DialogTitle>
          <DialogDescription>
            Update guest, schedule, area, and pricing for {booking?.booking_code}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void save(event)} className="space-y-3">
          <label className="block text-[11px] font-semibold text-slate-500">
            Event area
            <select
              required
              value={form.offeringId}
              onChange={(event) => setForm({ ...form, offeringId: event.target.value })}
              className={editField}
            >
              <option value="">Choose an area</option>
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.title}
                  {offering.availability === 'unavailable' ? ' (unavailable)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-slate-500">
              Guest name
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={editField}
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Guests
              <input
                required
                type="number"
                min={1}
                value={form.guests}
                onChange={(event) => setForm({ ...form, guests: event.target.value })}
                className={editField}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-slate-500">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={editField}
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Phone
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                className={editField}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-slate-500">
              From
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                className={editField}
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Until
              <input
                type="date"
                min={form.startDate || undefined}
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                className={editField}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-slate-500">
              Starts at
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                className={editField}
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Until time
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => setForm({ ...form, endTime: event.target.value })}
                className={editField}
              />
            </label>
          </div>

          <label className="block rounded-[10px] border border-violet-200 bg-violet-50 p-3 text-[11px] font-semibold text-violet-700 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-300">
            Total booking price
            <input
              required
              type="number"
              min={booking?.amount_paid ?? 0}
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              className={`${editField} text-slate-900 dark:text-slate-100`}
            />
            <span className="mt-1 block text-[10px] font-normal text-slate-500">
              Already paid: {formatMoney(booking?.amount_paid ?? 0)}
            </span>
          </label>

          <label className="block text-[11px] font-semibold text-slate-500">
            Occasion / guest requests
            <textarea
              rows={2}
              value={form.requests}
              onChange={(event) => setForm({ ...form, requests: event.target.value })}
              className={editField}
            />
          </label>
          <label className="block text-[11px] font-semibold text-slate-500">
            Internal notes
            <textarea
              rows={2}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className={editField}
            />
          </label>

          <DialogFooter>
            <button
              type="button"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="rounded-[9px] admin-hairline px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center rounded-[9px] bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManualEventReservation({
  offerings,
  bookings,
  category = 'event',
}: {
  offerings: EventOffering[];
  bookings: EventBooking[];
  category?: OfferingCategory;
}) {
  const invalidate = useInvalidateAdmin();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    offeringId: offerings[0]?.id ?? '',
    name: '',
    email: '',
    phone: '',
    guests: '1',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    amountOverride: '',
    priceMode: 'total' as 'total' | 'per_guest',
    amountPaid: '',
    status: 'confirmed' as Extract<BookingStatus, 'confirmed' | 'pending'>,
    notes: '',
  });

  const selected = offerings.find((e) => e.id === form.offeringId) ?? offerings[0];
  const guests = Math.max(1, Number(form.guests) || 1);
  const defaultTotal = (selected?.price || 0) * guests;
  const customPrice = Math.max(0, Number(form.amountOverride) || 0);
  const total =
    form.amountOverride.trim() === ''
      ? defaultTotal
      : form.priceMode === 'per_guest'
        ? customPrice * guests
        : customPrice;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      toast.error(
        category === 'pool'
          ? 'Add a pool package first (Packages tab)'
          : 'Add an event area first (Areas tab)',
      );
      return;
    }
    if (!form.startDate) {
      toast.error('Choose a start date');
      return;
    }
    const endDate = form.endDate || form.startDate;
    if (endDate < form.startDate) {
      toast.error('Until date must be on or after the start date');
      return;
    }
    if (selected.availability === 'unavailable') {
      toast.error('This area is marked unavailable');
      return;
    }
    if (areaRangeConflicts(bookings, selected.id, form.startDate, endDate)) {
      toast.error('That date range is already reserved for this area');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const code = makeEventBookingCode();
      const paid = Math.max(0, Number(form.amountPaid) || 0);
      const initialPayment =
        paid > 0
          ? [{ id: crypto.randomUUID(), amount: paid, paid_at: new Date().toISOString() }]
          : [];
      const { data, error } = await supabase
        .from('event_bookings')
        .insert({
          booking_code: code,
          event_id: null,
          offering_id: selected.id,
          event_title: selected.title,
          event_date: form.startDate,
          event_end_date: endDate,
          start_time: form.startTime || null,
          end_time: form.endTime || null,
          name: form.name.trim(),
          email: form.email.trim() || 'walk-in@aeyyyy.local',
          phone: form.phone.trim() || null,
          guests,
          status: form.status,
          amount: total,
          amount_paid: paid,
          payment_history: initialPayment,
          currency: SYSTEM_CURRENCY,
          notes: form.notes.trim() || (category === 'pool' ? 'Walk-in pool reservation' : 'Walk-in event reservation'),
        })
        .select('id, booking_code')
        .single();
      if (error) throw error;

      if (paid > 0) {
        await supabase.from('income').insert({
          title: `${category === 'pool' ? 'Pool' : 'Event'} walk-in ${data.booking_code} — ${form.name.trim()}`,
          category: 'booking',
          amount: paid,
          currency: SYSTEM_CURRENCY,
          income_date: form.startDate,
          notes: `${selected.title} · ${guests} guest${guests === 1 ? '' : 's'}`,
        });
      }

      await logActivity({
        action: 'created',
        entity: 'event_booking',
        entityId: data.id,
        summary: `Added walk-in ${category === 'pool' ? 'pool' : 'event'} booking ${data.booking_code} for “${selected.title}”`,
      });
      await invalidate(paid > 0 ? ['eventBookings', 'income', 'activity'] : ['eventBookings', 'activity']);
      toast.success(
        category === 'pool' ? 'Pool reservation created' : 'Event reservation created',
        {
          description: `${data.booking_code} · ${form.name.trim()}`,
        },
      );
      setOpen(false);
      setForm({
        offeringId: offerings[0]?.id ?? '',
        name: '',
        email: '',
        phone: '',
        guests: '1',
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
        amountOverride: '',
        priceMode: 'total',
        amountPaid: '',
        status: 'confirmed',
        notes: '',
      });
    } catch (err) {
      toast.error('Could not create reservation', {
        description:
          err instanceof Error
            ? `${err.message} — run supabase/event-areas-schema.sql if needed.`
            : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const compactField =
    'mt-1 h-9 w-full min-w-0 rounded-[8px] border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-amber-950';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-[9px] bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          <Plus className="h-4 w-4" />
          Walk-in
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b border-amber-200 bg-gradient-to-r from-amber-100/90 via-orange-50 to-teal-50 px-4 py-3 text-left dark:border-amber-900/40 dark:from-amber-950/35 dark:via-orange-950/20 dark:to-teal-950/30 sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[#0b3b3c] text-amber-100 shadow-sm">
              <Plus className="h-4 w-4" />
            </span>
            Walk-in {category === 'pool' ? 'pool' : 'event'} reservation
          </DialogTitle>
          <DialogDescription className="text-xs">
            {category === 'pool'
              ? 'Add a guest who booked the pool in person.'
              : 'Add a guest who reserved an area in person.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-2.5 px-4 py-3 sm:px-5 sm:py-4">
          <label className="block rounded-[9px] border border-teal-200 bg-teal-50/70 p-2.5 text-[10px] font-bold uppercase tracking-wide text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/25 dark:text-teal-200">
            {category === 'pool' ? 'Pool package' : 'Event area'}
            <select
              required
              value={form.offeringId || selected?.id || ''}
              onChange={(e) => setForm({ ...form, offeringId: e.target.value })}
              className={`${compactField} border-teal-200 font-semibold dark:border-teal-900`}
            >
              {offerings.length === 0 && (
                <option value="">
                  {category === 'pool' ? 'No pool packages' : 'No event areas'}
                </option>
              )}
              {offerings.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.availability === 'unavailable' ? ' (unavailable)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-slate-500">
              From
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className={compactField}
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              Until when
              <input
                type="date"
                min={form.startDate || undefined}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={compactField}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-slate-500">
              Starts at
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className={compactField}
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              Until (time)
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className={compactField}
              />
            </label>
          </div>
          <div className="rounded-[9px] border border-amber-200/70 bg-[#fff8e8] p-2.5 dark:border-amber-900/40 dark:bg-amber-950/15">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Guest details
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-medium text-slate-500">
                Guest name
                <input
                  required
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={compactField}
                />
              </label>
              <label className="text-[11px] font-medium text-slate-500">
                Number of guests
                <input
                  required
                  type="number"
                  min={1}
                  placeholder="1"
                  value={form.guests}
                  onChange={(e) => setForm({ ...form, guests: e.target.value })}
                  className={compactField}
                />
              </label>
              <label className="text-[11px] font-medium text-slate-500">
                Phone
                <input
                  placeholder="Contact number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={compactField}
                />
              </label>
              <label className="text-[11px] font-medium text-slate-500">
                Email
                <input
                  type="email"
                  placeholder="Optional"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={compactField}
                />
              </label>
            </div>
          </div>
          <div className="rounded-[10px] border border-orange-200/80 bg-orange-50/60 p-2.5 dark:border-orange-900/50 dark:bg-orange-950/20">
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-[8px] bg-amber-100/90 p-1 dark:bg-amber-950/50">
              <button
                type="button"
                onClick={() => setForm({ ...form, priceMode: 'total' })}
                className={cn(
                  'rounded-[6px] px-2 py-1.5 text-[10px] font-bold transition',
                  form.priceMode === 'total'
                    ? 'bg-[#0b3b3c] text-amber-50 shadow-sm dark:bg-teal-900 dark:text-amber-100'
                    : 'text-amber-800 dark:text-amber-400',
                )}
              >
                All guests / total
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, priceMode: 'per_guest' })}
                className={cn(
                  'rounded-[6px] px-2 py-1.5 text-[10px] font-bold transition',
                  form.priceMode === 'per_guest'
                    ? 'bg-[#0b3b3c] text-amber-50 shadow-sm dark:bg-teal-900 dark:text-amber-100'
                    : 'text-amber-800 dark:text-amber-400',
                )}
              >
                Price per guest
              </button>
            </div>
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1 text-[11px] font-medium text-slate-500">
                {form.priceMode === 'per_guest' ? 'Custom price per guest' : 'Custom booking total'}
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {SYSTEM_CURRENCY === 'PHP' ? '₱' : SYSTEM_CURRENCY}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={String(defaultTotal)}
                    value={form.amountOverride}
                    onChange={(e) => setForm({ ...form, amountOverride: e.target.value })}
                    className="h-9 w-full rounded-[8px] border border-amber-300 bg-white pl-8 pr-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-100 dark:border-amber-900 dark:bg-slate-950"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, amountOverride: '', priceMode: 'total' })
                }
                disabled={form.amountOverride === ''}
                className="h-9 shrink-0 rounded-[8px] bg-amber-200/80 px-2.5 text-[10px] font-bold text-amber-900 disabled:opacity-40 dark:bg-amber-950/60 dark:text-amber-300"
              >
                Use default
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
              {form.amountOverride.trim() === ''
                ? `Default: ${formatMoney(selected?.price || 0)} × ${guests} guest${
                    guests === 1 ? '' : 's'
                  } = ${formatMoney(defaultTotal)}.`
                : form.priceMode === 'per_guest'
                  ? `${formatMoney(customPrice)} × ${guests} guest${
                      guests === 1 ? '' : 's'
                    } = ${formatMoney(total)} total.`
                  : `${formatMoney(total)} covers all ${guests} guest${
                      guests === 1 ? '' : 's'
                    }.`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-slate-500">
              Amount paid
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder={`Due ${formatMoney(total)}`}
                value={form.amountPaid}
                onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
                className={compactField}
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as Extract<BookingStatus, 'confirmed' | 'pending'>,
                  })
                }
                className={compactField}
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </label>
          </div>
          <label className="block text-[11px] font-medium text-slate-500">
            Occasion / notes
            <input
              placeholder="Birthday, gathering, special request…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={compactField}
            />
          </label>
          <DialogFooter className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving || offerings.length === 0}
              className="inline-flex h-9 items-center justify-center rounded-[8px] bg-gradient-to-r from-[#0b3b3c] to-[#176b69] px-4 text-xs font-bold text-amber-50 shadow-sm hover:from-[#082f30] hover:to-[#125755] disabled:opacity-50"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save reservation
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
