'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useInvalidateAdmin } from '@/lib/admin/queries';
import {
  calculateStayAmount,
  formatMoney,
  nightsBetween,
  SYSTEM_CURRENCY,
} from '@/lib/money';
import {
  getStayAvailability,
  todayIsoLocal,
} from '@/lib/room-status';
import type { Booking, BookingStatus } from '@/lib/types/booking';
import type { Room } from '@/lib/types/room';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type ManualForm = {
  name: string;
  email: string;
  phone: string;
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: string;
  children: string;
  rate: string;
  amountPaid: string;
  status: Extract<BookingStatus, 'confirmed' | 'pending'>;
  requests: string;
  notes: string;
};

function initialForm(room?: Room): ManualForm {
  return {
    name: '',
    email: '',
    phone: '',
    destination: room?.name ?? '',
    checkIn: todayIsoLocal(),
    checkOut: '',
    adults: '1',
    children: '0',
    rate: room ? String(room.price_per_night) : '',
    amountPaid: '0',
    status: 'confirmed',
    requests: '',
    notes: 'Walk-in reservation',
  };
}

function walkInCode() {
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `WI${time}${random}`;
}

const fieldClass =
  'w-full rounded-[9px] admin-hairline bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-accent/25 dark:bg-slate-950 dark:text-slate-100';

function FieldLabel({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? 'sm:col-span-2' : undefined}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ManualReservationDialog({
  rooms,
  bookings,
}: {
  rooms: Room[];
  bookings: Booking[];
}) {
  const invalidate = useInvalidateAdmin();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ManualForm>(() => initialForm(rooms[0]));

  useEffect(() => {
    if (form.destination || rooms.length === 0) return;
    setForm((prev) => ({
      ...prev,
      destination: rooms[0].name,
      rate: String(rooms[0].price_per_night),
    }));
  }, [form.destination, rooms]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.name === form.destination) ?? null,
    [form.destination, rooms],
  );

  const confirmedStays = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === 'confirmed')
        .map((booking) => ({
          destination: booking.destination,
          check_in: booking.check_in,
          check_out: booking.check_out,
        })),
    [bookings],
  );

  const availability = useMemo(
    () =>
      getStayAvailability(
        selectedRoom,
        confirmedStays,
        form.checkIn,
        form.checkOut,
      ),
    [confirmedStays, form.checkIn, form.checkOut, selectedRoom],
  );

  const nights = nightsBetween(form.checkIn, form.checkOut);
  const rate = Number(form.rate) || 0;
  const total = calculateStayAmount(rate, form.checkIn, form.checkOut, 1);
  const paid = Math.max(0, Number(form.amountPaid) || 0);
  const invalidDates = Boolean(form.checkOut) && nights < 1;
  const blocked = availability.kind !== 'open';

  const set = (key: keyof ManualForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const chooseRoom = (name: string) => {
    const room = rooms.find((item) => item.name === name);
    setForm((prev) => ({
      ...prev,
      destination: name,
      rate: room ? String(room.price_per_night) : prev.rate,
    }));
  };

  const reset = () => setForm(initialForm(rooms[0]));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRoom) {
      toast.error('Choose a room');
      return;
    }
    if (invalidDates || nights < 1) {
      toast.error('Check-out must be after check-in');
      return;
    }
    if (availability.kind === 'unavailable') {
      toast.error('This room is manually marked unavailable');
      return;
    }
    if (availability.kind === 'conflict') {
      toast.error('This room already has a confirmed stay on those dates');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const code = walkInCode();
      const { data: inserted, error } = await supabase
        .from('bookings')
        .insert({
          booking_code: code,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          destination: selectedRoom.name,
          check_in: form.checkIn,
          check_out: form.checkOut,
          adults: Math.max(1, Number(form.adults) || 1),
          children: Math.max(0, Number(form.children) || 0),
          rooms: 1,
          requests: form.requests.trim() || null,
          status: form.status,
          rate_per_night: rate,
          amount: total,
          amount_paid: paid,
          other_charges: [],
          currency: SYSTEM_CURRENCY,
          notes: form.notes.trim() || 'Walk-in reservation',
        })
        .select('id, booking_code')
        .single();
      if (error) throw error;

      let incomeWarning = '';
      if (paid > 0 && inserted) {
        const { error: incomeError } = await supabase.from('income').insert({
          title: `Walk-in ${inserted.booking_code} — ${form.name.trim()}`,
          category: 'booking',
          amount: paid,
          currency: SYSTEM_CURRENCY,
          income_date: todayIsoLocal(),
          booking_id: inserted.id,
          notes: `${selectedRoom.name} (${form.checkIn} to ${form.checkOut})`,
        });
        if (incomeError) incomeWarning = ' Payment was saved, but income could not be recorded.';
      }

      await invalidate(paid > 0 ? ['bookings', 'income'] : ['bookings']);
      toast.success('Walk-in reservation created', {
        description: `${inserted.booking_code} · ${form.name.trim()} · ${selectedRoom.name}${incomeWarning}`,
      });
      setOpen(false);
      reset();
    } catch (error) {
      toast.error('Could not create reservation', {
        description: error instanceof Error ? error.message : 'Insert failed',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[9px] bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plus className="h-4 w-4" />
          Add walk-in
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl dark:border-slate-800 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle>New walk-in reservation</DialogTitle>
          <DialogDescription>
            Record a reservation received in person or by phone. Confirmed stays immediately
            affect room availability.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Guest name">
              <input
                required
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                className={fieldClass}
                placeholder="Full name"
              />
            </FieldLabel>
            <FieldLabel label="Phone">
              <input
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
                className={fieldClass}
                placeholder="Contact number"
              />
            </FieldLabel>
            <FieldLabel label="Email (optional)">
              <input
                type="email"
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
                className={fieldClass}
                placeholder="guest@email.com"
              />
            </FieldLabel>
            <FieldLabel label="Room">
              <select
                required
                value={form.destination}
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
            </FieldLabel>
            <FieldLabel label="Check-in">
              <input
                required
                type="date"
                value={form.checkIn}
                onChange={(event) => set('checkIn', event.target.value)}
                className={fieldClass}
              />
            </FieldLabel>
            <FieldLabel label="Check-out">
              <input
                required
                type="date"
                min={form.checkIn}
                value={form.checkOut}
                onChange={(event) => set('checkOut', event.target.value)}
                className={fieldClass}
              />
            </FieldLabel>
            <FieldLabel label="Adults">
              <input
                required
                type="number"
                min={1}
                value={form.adults}
                onChange={(event) => set('adults', event.target.value)}
                className={fieldClass}
              />
            </FieldLabel>
            <FieldLabel label="Children">
              <input
                type="number"
                min={0}
                value={form.children}
                onChange={(event) => set('children', event.target.value)}
                className={fieldClass}
              />
            </FieldLabel>
            <FieldLabel label="Rate per night">
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.rate}
                onChange={(event) => set('rate', event.target.value)}
                className={fieldClass}
              />
            </FieldLabel>
            <FieldLabel label="Amount paid">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amountPaid}
                onChange={(event) => set('amountPaid', event.target.value)}
                className={fieldClass}
              />
            </FieldLabel>
            <FieldLabel label="Reservation status">
              <select
                value={form.status}
                onChange={(event) =>
                  set('status', event.target.value as ManualForm['status'])
                }
                className={fieldClass}
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </FieldLabel>
            <div className="rounded-[9px] bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800">
              <p className="text-xs font-semibold text-slate-500">Stay total</p>
              <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
                {nights > 0
                  ? `${formatMoney(total)} · ${nights} night${nights === 1 ? '' : 's'}`
                  : 'Select valid dates'}
              </p>
            </div>
            <FieldLabel label="Special requests" wide>
              <textarea
                rows={2}
                value={form.requests}
                onChange={(event) => set('requests', event.target.value)}
                className={fieldClass}
                placeholder="Guest requests or preferences"
              />
            </FieldLabel>
            <FieldLabel label="Internal notes" wide>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) => set('notes', event.target.value)}
                className={fieldClass}
                placeholder="Visible to admins only"
              />
            </FieldLabel>
          </div>

          {availability.kind === 'unavailable' && (
            <p className="rounded-[9px] bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              This room is currently marked unavailable.
            </p>
          )}
          {availability.kind === 'conflict' && (
            <p className="rounded-[9px] bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Conflicts with a confirmed stay from {availability.stay.check_in} to{' '}
              {availability.stay.check_out}.
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="rounded-[9px] admin-hairline px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || blocked || invalidDates || rooms.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Create reservation'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
