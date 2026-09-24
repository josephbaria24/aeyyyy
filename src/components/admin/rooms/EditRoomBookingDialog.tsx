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
  addDaysIso,
  bookingGrandTotal,
  newChargeId,
  otherChargesTotal,
  type Booking,
  type BookingCharge,
  type StayKind,
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
import { cn } from '@/lib/utils';

const fieldClass =
  'w-full rounded-[9px] admin-hairline bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-accent/25 dark:bg-slate-950 dark:text-slate-100';

type PriceMode = 'default' | 'custom';

type EditForm = {
  name: string;
  email: string;
  phone: string;
  destination: string;
  stayKind: StayKind;
  checkIn: string;
  checkOut: string;
  startTime: string;
  endTime: string;
  adults: string;
  children: string;
  rate: string;
  priceMode: PriceMode;
  customAmount: string;
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
    stayKind: 'overnight',
    checkIn: '',
    checkOut: '',
    startTime: '08:00',
    endTime: '14:00',
    adults: '1',
    children: '0',
    rate: '',
    priceMode: 'default',
    customAmount: '',
    amountPaid: '0',
    requests: '',
    notes: '',
  });

  useEffect(() => {
    if (!booking || !open) return;
    const isDayUse = booking.stay_kind === 'day_use';
    setForm({
      name: booking.name,
      email: booking.email,
      phone: booking.phone ?? '',
      destination: booking.destination,
      stayKind: isDayUse ? 'day_use' : 'overnight',
      checkIn: booking.check_in,
      checkOut: isDayUse ? '' : booking.check_out,
      startTime: booking.start_time ?? '08:00',
      endTime: booking.end_time ?? '14:00',
      adults: String(booking.adults),
      children: String(booking.children),
      rate: String(booking.rate_per_night),
      priceMode: 'custom',
      customAmount: String(booking.amount),
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

  const stayCheckIn = form.checkIn;
  const stayCheckOut =
    form.stayKind === 'day_use' ? addDaysIso(form.checkIn, 1) : form.checkOut;

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
      getStayAvailability(selectedRoom, confirmedStays, stayCheckIn, stayCheckOut),
    [confirmedStays, selectedRoom, stayCheckIn, stayCheckOut],
  );

  const nights =
    form.stayKind === 'day_use' ? 1 : nightsBetween(form.checkIn, form.checkOut);
  const rate = Number(form.rate) || 0;
  const defaultStayTotal =
    form.stayKind === 'day_use'
      ? rate
      : calculateStayAmount(rate, form.checkIn, form.checkOut, 1);
  const customStayTotal = Math.max(0, Number(form.customAmount) || 0);
  const stayTotal =
    form.priceMode === 'custom' ? customStayTotal : defaultStayTotal;
  const storedRate =
    form.stayKind === 'day_use'
      ? stayTotal
      : form.priceMode === 'custom' && nights > 0
        ? Math.round((stayTotal / nights) * 100) / 100
        : rate;
  const extrasTotal = otherChargesTotal(otherCharges);
  const dueTotal = bookingGrandTotal({ amount: stayTotal, other_charges: otherCharges });
  const paid = Math.max(0, Number(form.amountPaid) || 0);
  const invalidOvernight = form.stayKind === 'overnight' && nights < 1;
  const invalidDayUse =
    form.stayKind === 'day_use' &&
    (!form.checkIn || !form.startTime || !form.endTime || form.endTime <= form.startTime);
  const invalidDates = invalidOvernight || invalidDayUse;

  const set = (key: keyof EditForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setStayKind = (stayKind: StayKind) => {
    setForm((prev) => ({
      ...prev,
      stayKind,
      priceMode: stayKind === 'day_use' ? 'custom' : prev.priceMode,
      customAmount:
        stayKind === 'day_use' && prev.customAmount === ''
          ? prev.rate || String(prev.customAmount)
          : prev.customAmount,
    }));
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
    if (form.stayKind === 'overnight' && (!form.checkIn || !form.checkOut || nights < 1)) {
      toast.error('Check-out must be after check-in');
      return;
    }
    if (form.stayKind === 'day_use') {
      if (!form.startTime || !form.endTime) {
        toast.error('Set start and end times for the timed stay');
        return;
      }
      if (form.endTime <= form.startTime) {
        toast.error('End time must be after start time');
        return;
      }
    }
    if (form.priceMode === 'custom' && form.customAmount.trim() === '') {
      toast.error('Enter a custom stay price, or switch back to the default rate');
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
      const checkOut =
        form.stayKind === 'day_use' ? addDaysIso(form.checkIn, 1) : form.checkOut;
      const { error } = await supabase
        .from('bookings')
        .update({
          name: form.name.trim(),
          email: form.email.trim() || 'walk-in@aeyyyy.local',
          phone: form.phone.trim() || null,
          destination: form.destination.trim(),
          check_in: form.checkIn,
          check_out: checkOut,
          adults: Math.max(1, Number(form.adults) || 1),
          children: Math.max(0, Number(form.children) || 0),
          stay_kind: form.stayKind,
          start_time: form.stayKind === 'day_use' ? form.startTime : null,
          end_time: form.stayKind === 'day_use' ? form.endTime : null,
          rate_per_night: storedRate,
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

            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Stay type
              </p>
              <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setStayKind('overnight')}
                  className={cn(
                    'rounded-[8px] px-3 py-2 text-xs font-bold transition',
                    form.stayKind === 'overnight'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                  )}
                >
                  Overnight (default)
                </button>
                <button
                  type="button"
                  onClick={() => setStayKind('day_use')}
                  className={cn(
                    'rounded-[8px] px-3 py-2 text-xs font-bold transition',
                    form.stayKind === 'day_use'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                  )}
                >
                  Timed stay (hours)
                </button>
              </div>
            </div>

            {form.stayKind === 'overnight' ? (
              <>
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
              </>
            ) : (
              <>
                <FieldLabel label="Stay date">
                  <input
                    required
                    type="date"
                    value={form.checkIn}
                    onChange={(event) => set('checkIn', event.target.value)}
                    className={fieldClass}
                  />
                </FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <FieldLabel label="From">
                    <input
                      required
                      type="time"
                      value={form.startTime}
                      onChange={(event) => set('startTime', event.target.value)}
                      className={fieldClass}
                    />
                  </FieldLabel>
                  <FieldLabel label="Until">
                    <input
                      required
                      type="time"
                      value={form.endTime}
                      onChange={(event) => set('endTime', event.target.value)}
                      className={fieldClass}
                    />
                  </FieldLabel>
                </div>
              </>
            )}

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

            <div className="space-y-3 rounded-[11px] border border-orange-200/80 bg-orange-50/50 p-3 dark:border-orange-900/40 dark:bg-orange-950/20 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-orange-900 dark:text-orange-200">
                    Stay price
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Default room rate or a custom amount for this stay.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-[8px] bg-orange-100/90 p-1 dark:bg-orange-950/50">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        priceMode: 'default',
                        customAmount: '',
                      }))
                    }
                    className={cn(
                      'rounded-[6px] px-2.5 py-1.5 text-[10px] font-bold transition',
                      form.priceMode === 'default'
                        ? 'bg-[#0b3b3c] text-amber-50 shadow-sm dark:bg-teal-900 dark:text-amber-100'
                        : 'text-orange-900 dark:text-orange-300',
                    )}
                  >
                    Default rate
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        priceMode: 'custom',
                        customAmount:
                          prev.customAmount ||
                          String(defaultStayTotal || Number(prev.rate) || 0),
                      }))
                    }
                    className={cn(
                      'rounded-[6px] px-2.5 py-1.5 text-[10px] font-bold transition',
                      form.priceMode === 'custom'
                        ? 'bg-[#0b3b3c] text-amber-50 shadow-sm dark:bg-teal-900 dark:text-amber-100'
                        : 'text-orange-900 dark:text-orange-300',
                    )}
                  >
                    Custom price
                  </button>
                </div>
              </div>

              {form.priceMode === 'default' ? (
                <FieldLabel
                  label={form.stayKind === 'day_use' ? 'Stay price' : 'Rate per night'}
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      {SYSTEM_CURRENCY_SYMBOL}
                    </span>
                    <input
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.rate}
                      onChange={(event) => set('rate', event.target.value)}
                      className={`${fieldClass} pl-7`}
                    />
                  </div>
                </FieldLabel>
              ) : (
                <FieldLabel
                  label={
                    form.stayKind === 'day_use' ? 'Custom stay price' : 'Custom stay total'
                  }
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      {SYSTEM_CURRENCY_SYMBOL}
                    </span>
                    <input
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.customAmount}
                      onChange={(event) => set('customAmount', event.target.value)}
                      className={`${fieldClass} pl-7`}
                    />
                  </div>
                </FieldLabel>
              )}
            </div>

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
                {!invalidDates
                  ? `${formatMoney(dueTotal)}${
                      extrasTotal > 0
                        ? ` · stay ${formatMoney(stayTotal)} + extras ${formatMoney(extrasTotal)}`
                        : ''
                    }${
                      form.stayKind === 'day_use'
                        ? ` · ${form.startTime}–${form.endTime}`
                        : ` · ${nights} night${nights === 1 ? '' : 's'}`
                    }`
                  : form.stayKind === 'day_use'
                    ? 'Set a valid time window'
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
                invalidDates ||
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
