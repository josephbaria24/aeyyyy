'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Link2, Loader2, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/admin/activity-log';
import {
  useEventBookings,
  useInvalidateAdmin,
  useOfferings,
} from '@/lib/admin/queries';
import { adminRoomsHref } from '@/lib/admin/rooms-hub';
import { areaRangeConflicts } from '@/lib/event-status';
import type { EventOffering } from '@/lib/types/event-offering';
import { formatMoney, SYSTEM_CURRENCY } from '@/lib/money';
import {
  BOOKING_STATUS_LABEL,
  type BookingStatus,
} from '@/lib/types/booking';
import {
  eventBookingUnpaid,
  makeEventBookingCode,
  type EventBooking,
} from '@/lib/types/event-booking';
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

const STATUS_ACTIONS: { status: BookingStatus; label: string }[] = [
  { status: 'confirmed', label: 'Confirm' },
  { status: 'declined', label: 'Decline' },
  { status: 'rescheduled', label: 'Reschedule' },
  { status: 'cancelled', label: 'Cancel' },
  { status: 'pending', label: 'Set pending' },
];

const EMPTY: EventBooking[] = [];

export function EventBookingsTab({
  focusBookingId,
}: {
  focusBookingId?: string | null;
}) {
  const bookingsQuery = useEventBookings();
  const offeringsQuery = useOfferings();
  const invalidate = useInvalidateAdmin();
  const bookings = bookingsQuery.data ?? EMPTY;
  const offerings = offeringsQuery.data ?? [];
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)),
    [bookings, filter],
  );

  useEffect(() => {
    if (!focusBookingId) return;
    const el = document.getElementById(`event-booking-${focusBookingId}`);
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
        const incomeAmount =
          Number(booking.amount_paid) > 0
            ? Number(booking.amount_paid)
            : Number(booking.amount) || 0;
        if (incomeAmount > 0) {
          await supabase.from('income').insert({
            title: `Event ${booking.booking_code} — ${booking.name}`,
            category: 'booking',
            amount: incomeAmount,
            currency: booking.currency || SYSTEM_CURRENCY,
            income_date: new Date().toISOString().slice(0, 10),
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

  const savePayment = async (booking: EventBooking, amountPaid: number) => {
    setUpdatingId(booking.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('event_bookings')
        .update({ amount_paid: amountPaid })
        .eq('id', booking.id);
      if (error) throw error;
      await logActivity({
        action: 'updated',
        entity: 'event_booking',
        entityId: booking.id,
        summary: `Updated payment for ${booking.booking_code}`,
        details: { amount_paid: amountPaid },
      });
      await invalidate(['eventBookings', 'activity']);
      toast.success('Payment saved');
    } catch (err) {
      toast.error('Could not save payment', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Event bookings</h2>
          <p className="text-sm text-slate-500">Reservations for inn areas — confirm, pay, or reschedule.</p>
        </div>
        <ManualEventReservation
          offerings={offerings.filter((o) => o.is_active)}
          bookings={bookings}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'confirmed', 'declined', 'cancelled', 'rescheduled'] as const).map(
          (id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                'rounded-[9px] px-3 py-1.5 text-xs font-semibold capitalize',
                filter === id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'admin-hairline bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              {id}
            </button>
          ),
        )}
      </div>

      <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
        {bookingsQuery.isPending && !bookings.length ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                    onSavePaid={(paid) => void savePayment(booking, paid)}
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
        )}
      </div>
    </div>
  );
}

function EventBookingRow({
  booking,
  focused,
  updating,
  onStatus,
  onSavePaid,
}: {
  booking: EventBooking;
  focused: boolean;
  updating: boolean;
  onStatus: (status: BookingStatus) => void;
  onSavePaid: (amount: number) => void;
}) {
  const [paid, setPaid] = useState(String(booking.amount_paid || ''));
  const unpaid = eventBookingUnpaid(booking);

  return (
    <tr
      id={`event-booking-${booking.id}`}
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
            className="w-24 rounded-[7px] admin-hairline px-2 py-1 text-xs dark:bg-slate-950"
          />
          <button
            type="button"
            disabled={updating}
            onClick={() => onSavePaid(Number(paid) || 0)}
            className="rounded-[7px] bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Save
          </button>
        </div>
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

function ManualEventReservation({
  offerings,
  bookings,
}: {
  offerings: EventOffering[];
  bookings: EventBooking[];
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
    amountPaid: '',
    status: 'confirmed' as Extract<BookingStatus, 'confirmed' | 'pending'>,
    notes: '',
  });

  const selected = offerings.find((e) => e.id === form.offeringId) ?? offerings[0];
  const guests = Math.max(1, Number(form.guests) || 1);
  const total = (selected?.price || 0) * guests;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      toast.error('Add an event area first (Areas tab)');
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
          currency: SYSTEM_CURRENCY,
          notes: form.notes.trim() || 'Walk-in event reservation',
        })
        .select('id, booking_code')
        .single();
      if (error) throw error;

      if (paid > 0) {
        await supabase.from('income').insert({
          title: `Event walk-in ${data.booking_code} — ${form.name.trim()}`,
          category: 'booking',
          amount: paid,
          currency: SYSTEM_CURRENCY,
          income_date: new Date().toISOString().slice(0, 10),
          notes: selected.title,
        });
      }

      await logActivity({
        action: 'created',
        entity: 'event_booking',
        entityId: data.id,
        summary: `Added walk-in event booking ${data.booking_code} for “${selected.title}”`,
      });
      await invalidate(paid > 0 ? ['eventBookings', 'income', 'activity'] : ['eventBookings', 'activity']);
      toast.success('Event reservation created', {
        description: `${data.booking_code} · ${form.name.trim()}`,
      });
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Walk-in event reservation</DialogTitle>
          <DialogDescription>Add a guest who reserved an area in person.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <select
            required
            value={form.offeringId || selected?.id || ''}
            onChange={(e) => setForm({ ...form, offeringId: e.target.value })}
            className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
          >
            {offerings.length === 0 && <option value="">No event areas</option>}
            {offerings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
                {item.availability === 'unavailable' ? ' (unavailable)' : ''}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-slate-500">
              From
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-1 w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              Until when
              <input
                type="date"
                min={form.startDate || undefined}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="mt-1 w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
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
                className="mt-1 w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              Until (time)
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="mt-1 w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
              />
            </label>
          </div>
          <input
            required
            placeholder="Guest name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
            />
            <input
              type="number"
              min={1}
              placeholder="Guests"
              value={form.guests}
              onChange={(e) => setForm({ ...form, guests: e.target.value })}
              className="rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder={`Paid (due ${formatMoney(total)})`}
              value={form.amountPaid}
              onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
              className="rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
            />
            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as Extract<BookingStatus, 'confirmed' | 'pending'>,
                })
              }
              className="rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
            >
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <input
            placeholder="Occasion / notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950"
          />
          <DialogFooter>
            <button
              type="submit"
              disabled={saving || offerings.length === 0}
              className="inline-flex items-center rounded-[9px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
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
