'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useInvalidateAdmin } from '@/lib/admin/queries';
import { logActivity } from '@/lib/admin/activity-log';
import {
  calculateStayAmount,
  formatMoney,
  nightsBetween,
  SYSTEM_CURRENCY_SYMBOL,
} from '@/lib/money';
import { getStayAvailability } from '@/lib/room-status';
import {
  bookingGrandTotal,
  newChargeId,
  otherChargesTotal,
  type Booking,
  type BookingCharge,
} from '@/lib/types/booking';
import type { Room } from '@/lib/types/room';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const fieldClass =
  'w-full rounded-[9px] admin-hairline bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-accent/25 dark:bg-slate-950 dark:text-slate-100';

type EditForm = {
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
  requests: string;
  notes: string;
};

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

export function EditRoomBookingDialog({
  booking,
  bookings,
  rooms,
  open,
  onOpenChange,
}: {
  booking: Booking | null;
  bookings: Booking[];
  rooms: Room[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useInvalidateAdmin();
  const [saving, setSaving] = useState(false);
  const [otherCharges, setOtherCharges] = useState<BookingCharge[]>([]);
  const [form, setForm] = useState<EditForm>({
    name: '',
    email: '',
    phone: '',
    destination: '',
    checkIn: '',
    checkOut: '',
    adults: '1',
    children: '0',
    rate: '',
    amountPaid: '0',
    requests: '',
    notes: '',
  });

  useEffect(() => {
    if (!booking || !open) return;
    setForm({
      name: booking.name,
      email: booking.email,
      phone: booking.phone ?? '',
      destination: booking.destination,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      adults: String(booking.adults),
      children: String(booking.children),
      rate: String(booking.rate_per_night),
      amountPaid: String(booking.amount_paid),
      requests: booking.requests ?? '',
      notes: booking.notes ?? '',
    });
    setOtherCharges(booking.other_charges.map((charge) => ({ ...charge })));
  }, [booking, open]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.name === form.destination) ?? null,
    [form.destination, rooms],
  );

  const confirmedStays = useMemo(
    () =>
      bookings
        .filter((item) => item.status === 'confirmed' && item.id !== booking?.id)
        .map((item) => ({
          destination: item.destination,
          check_in: item.check_in,
          check_out: item.check_out,
        })),
    [bookings, booking?.id],
  );

  const availability = useMemo(
    () =>
      getStayAvailability(selectedRoom, confirmedStays, form.checkIn, form.checkOut),
    [confirmedStays, form.checkIn, form.checkOut, selectedRoom],
  );

  const nights = nightsBetween(form.checkIn, form.checkOut);
  const rate = Number(form.rate) || 0;
  const stayTotal = calculateStayAmount(rate, form.checkIn, form.checkOut, 1);
  const extrasTotal = otherChargesTotal(otherCharges);
  const dueTotal = bookingGrandTotal({ amount: stayTotal, other_charges: otherCharges });
  const paid = Math.max(0, Number(form.amountPaid) || 0);

  const set = (key: keyof EditForm, value: string) => {
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

  const addCharge = () => {
    setOtherCharges((current) => [...current, { id: newChargeId(), label: '', amount: 0 }]);
  };

  const updateCharge = (id: string, patch: Partial<Pick<BookingCharge, 'label' | 'amount'>>) => {
    setOtherCharges((current) =>
      current.map((charge) => (charge.id === id ? { ...charge, ...patch } : charge)),
    );
  };

  const removeCharge = (id: string) => {
    setOtherCharges((current) => current.filter((charge) => charge.id !== id));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!booking) return;
    if (!form.destination.trim()) {
      toast.error('Choose a room');
      return;
    }
    if (!form.checkIn || !form.checkOut || nights < 1) {
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

    const cleanedCharges = otherCharges
      .map((charge) => ({
        id: charge.id,
        label: charge.label.trim(),
        amount: Math.max(0, Number(charge.amount) || 0),
      }))
      .filter((charge) => charge.label || charge.amount > 0);

    if (cleanedCharges.some((charge) => charge.amount > 0 && !charge.label)) {
      toast.error('Add a description for each other charge');
      return;
    }

    if (paid > dueTotal) {
      toast.error('Amount paid cannot exceed the due total', {
        description: `Due is ${formatMoney(dueTotal)}.`,
      });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('bookings')
        .update({
          name: form.name.trim(),
          email: form.email.trim() || 'walk-in@aeyyyy.local',
          phone: form.phone.trim() || null,
          destination: form.destination.trim(),
          check_in: form.checkIn,
          check_out: form.checkOut,
          adults: Math.max(1, Number(form.adults) || 1),
          children: Math.max(0, Number(form.children) || 0),
          rate_per_night: rate,
          amount: stayTotal,
          amount_paid: paid,
          other_charges: cleanedCharges,
          requests: form.requests.trim() || null,
          notes: form.notes.trim() || null,
        })
        .eq('id', booking.id);
      if (error) throw error;

      await logActivity({
        action: 'updated',
        entity: 'booking',
        entityId: booking.id,
        summary: `Edited booking ${booking.booking_code} details`,
      });
      await invalidate(['bookings', 'activity']);
      toast.success('Booking updated', {
        description: `${booking.booking_code} · ${form.name.trim()}`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error('Could not update booking', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-2xl dark:border-slate-800 dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle>Edit reservation</DialogTitle>
          <DialogDescription>
            {booking
              ? `Update guest, room, dates, and charges for ${booking.booking_code}.`
              : 'Update booking details.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void save(event)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Guest name">
              <input
                required
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                className={fieldClass}
              />
            </FieldLabel>
            <FieldLabel label="Phone">
              <input
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
                className={fieldClass}
              />
            </FieldLabel>
            <FieldLabel label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
                className={fieldClass}
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
                {form.destination &&
                  !rooms.some((room) => room.name === form.destination) && (
                    <option value={form.destination}>{form.destination}</option>
                  )}
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

            <div className="space-y-2 rounded-[11px] border border-amber-200/70 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Other charges
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Extra fees — type what each charge is for.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCharge}
                  className="inline-flex items-center gap-1 rounded-[8px] bg-amber-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add charge
                </button>
              </div>
              {otherCharges.length === 0 ? (
                <p className="text-[11px] text-slate-500">No extra charges.</p>
              ) : (
                <div className="space-y-2">
                  {otherCharges.map((charge) => (
                    <div
                      key={charge.id}
                      className="grid grid-cols-[1fr_6.5rem_auto] items-center gap-2"
                    >
                      <input
                        type="text"
                        value={charge.label}
                        onChange={(event) =>
                          updateCharge(charge.id, { label: event.target.value })
                        }
                        placeholder="What is this for?"
                        className={fieldClass}
                      />
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                          {SYSTEM_CURRENCY_SYMBOL}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={charge.amount || ''}
                          onChange={(event) =>
                            updateCharge(charge.id, {
                              amount: Math.max(0, Number(event.target.value) || 0),
                            })
                          }
                          className={`${fieldClass} pl-7`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCharge(charge.id)}
                        aria-label="Remove charge"
                        className="grid h-9 w-9 place-items-center rounded-[8px] text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[9px] bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800 sm:col-span-2">
              <p className="text-xs font-semibold text-slate-500">Due total</p>
              <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
                {nights > 0
                  ? `${formatMoney(dueTotal)}${extrasTotal > 0 ? ` · stay ${formatMoney(stayTotal)} + extras ${formatMoney(extrasTotal)}` : ''} · ${nights} night${nights === 1 ? '' : 's'}`
                  : 'Select valid dates'}
              </p>
            </div>

            <FieldLabel label="Special requests" wide>
              <textarea
                rows={2}
                value={form.requests}
                onChange={(event) => set('requests', event.target.value)}
                className={fieldClass}
              />
            </FieldLabel>
            <FieldLabel label="Internal notes" wide>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) => set('notes', event.target.value)}
                className={fieldClass}
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
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="rounded-[9px] admin-hairline px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                nights < 1 ||
                availability.kind === 'unavailable' ||
                availability.kind === 'conflict'
              }
              className="inline-flex items-center justify-center gap-2 rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
