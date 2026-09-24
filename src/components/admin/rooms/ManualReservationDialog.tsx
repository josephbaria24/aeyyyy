'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useInvalidateAdmin } from '@/lib/admin/queries';
import {
  calculateStayAmount,
  formatMoney,
  nightsBetween,
  SYSTEM_CURRENCY,
  SYSTEM_CURRENCY_SYMBOL,
} from '@/lib/money';
import {
  getStayAvailability,
  todayIsoLocal,
} from '@/lib/room-status';
import {
  addDaysIso,
  bookingGrandTotal,
  newChargeId,
  otherChargesTotal,
  type Booking,
  type BookingCharge,
  type BookingStatus,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { logActivity } from '@/lib/admin/activity-log';
import { uploadToCloudinary } from '@/lib/upload';
import { cn } from '@/lib/utils';

type PriceMode = 'default' | 'custom';

type ManualForm = {
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
    stayKind: 'overnight',
    checkIn: todayIsoLocal(),
    checkOut: '',
    startTime: '08:00',
    endTime: '14:00',
    adults: '1',
    children: '0',
    rate: room ? String(room.price_per_night) : '',
    priceMode: 'default',
    customAmount: '',
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
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [otherCharges, setOtherCharges] = useState<BookingCharge[]>([]);
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

  const stayCheckIn = form.checkIn;
  const stayCheckOut =
    form.stayKind === 'day_use' ? addDaysIso(form.checkIn, 1) : form.checkOut;

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
  const total = bookingGrandTotal({ amount: stayTotal, other_charges: otherCharges });
  const paid = Math.max(0, Number(form.amountPaid) || 0);
  const invalidOvernight = form.stayKind === 'overnight' && Boolean(form.checkOut) && nights < 1;
  const invalidDayUse =
    form.stayKind === 'day_use' &&
    (!form.checkIn || !form.startTime || !form.endTime || form.endTime <= form.startTime);
  const invalidDates = invalidOvernight || invalidDayUse;
  const blocked = availability.kind !== 'open';

  const set = (key: keyof ManualForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setStayKind = (stayKind: StayKind) => {
    setForm((prev) => ({
      ...prev,
      stayKind,
      priceMode: stayKind === 'day_use' ? 'custom' : prev.priceMode,
      customAmount:
        stayKind === 'day_use' && prev.customAmount === ''
          ? prev.rate
          : prev.customAmount,
      checkOut: stayKind === 'overnight' ? prev.checkOut : '',
    }));
  };

  const chooseRoom = (name: string) => {
    const room = rooms.find((item) => item.name === name);
    setForm((prev) => ({
      ...prev,
      destination: name,
      rate: room ? String(room.price_per_night) : prev.rate,
      customAmount:
        prev.stayKind === 'day_use' && prev.priceMode === 'custom' && room
          ? String(room.price_per_night)
          : prev.customAmount,
    }));
  };

  const reset = () => {
    setForm(initialForm(rooms[0]));
    setEvidenceUrls([]);
    setOtherCharges([]);
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

  const uploadEvidence = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!selected.length) {
      toast.error('Choose an image or screenshot');
      return;
    }
    if (evidenceUrls.length + selected.length > 10) {
      toast.error('A booking can have up to 10 attachments');
      return;
    }

    setUploadingEvidence(true);
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        const asset = await uploadToCloudinary(file, 'aeyyyy/booking-evidence');
        uploaded.push(asset.secure_url);
      }
      setEvidenceUrls((current) => [...current, ...uploaded]);
      toast.success(`${uploaded.length} attachment${uploaded.length === 1 ? '' : 's'} ready`);
    } catch (error) {
      toast.error('Could not upload attachments', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUploadingEvidence(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRoom) {
      toast.error('Choose a room');
      return;
    }
    if (form.stayKind === 'overnight' && (invalidOvernight || nights < 1)) {
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

    setSaving(true);
    try {
      const supabase = createClient();
      const code = walkInCode();
      const checkOut = form.stayKind === 'day_use' ? addDaysIso(form.checkIn, 1) : form.checkOut;
      const { data: inserted, error } = await supabase
        .from('bookings')
        .insert({
          booking_code: code,
          name: form.name.trim(),
          email: form.email.trim() || 'walk-in@aeyyyy.local',
          phone: form.phone.trim() || null,
          destination: selectedRoom.name,
          check_in: form.checkIn,
          check_out: checkOut,
          adults: Math.max(1, Number(form.adults) || 1),
          children: Math.max(0, Number(form.children) || 0),
          rooms: 1,
          requests: form.requests.trim() || null,
          status: form.status,
          stay_kind: form.stayKind,
          start_time: form.stayKind === 'day_use' ? form.startTime : null,
          end_time: form.stayKind === 'day_use' ? form.endTime : null,
          rate_per_night: storedRate,
          amount: stayTotal,
          amount_paid: paid,
          other_charges: cleanedCharges,
          evidence_urls: evidenceUrls,
          currency: SYSTEM_CURRENCY,
          notes: form.notes.trim() || 'Walk-in reservation',
        })
        .select('id, booking_code')
        .single();
      if (error) throw error;

      let incomeWarning = '';
      if (paid > 0 && inserted) {
        const guestTotal =
          Math.max(1, Number(form.adults) || 1) + Math.max(0, Number(form.children) || 0);
        const stayNote =
          form.stayKind === 'day_use'
            ? `${selectedRoom.name} · ${form.checkIn} ${form.startTime}–${form.endTime}`
            : `${selectedRoom.name} (${form.checkIn} to ${checkOut})`;
        const { error: incomeError } = await supabase.from('income').insert({
          title: `Walk-in ${inserted.booking_code} — ${form.name.trim()}`,
          category: 'booking',
          amount: paid,
          currency: SYSTEM_CURRENCY,
          income_date: form.checkIn,
          booking_id: inserted.id,
          notes: `${stayNote} · ${guestTotal} guest${guestTotal === 1 ? '' : 's'}`,
        });
        if (incomeError) incomeWarning = ' Payment was saved, but income could not be recorded.';
      }

      await logActivity({
        action: 'created',
        entity: 'booking',
        entityId: inserted?.id,
        summary: `Added walk-in booking ${inserted?.booking_code} for ${selectedRoom.name}`,
      });
      await invalidate(paid > 0 ? ['bookings', 'income', 'activity'] : ['bookings', 'activity']);
      toast.success('Walk-in reservation created', {
        description: `${inserted.booking_code} · ${form.name.trim()} · ${selectedRoom.name}${incomeWarning}`,
      });
      setOpen(false);
      reset();
    } catch (error) {
      toast.error('Could not create reservation', {
        description:
          error instanceof Error
            ? `${error.message} — if stay_kind/time columns are missing, run supabase/booking-day-use.sql.`
            : 'Insert failed',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving && !uploadingEvidence) {
          setOpen(next);
          if (!next) reset();
        }
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
              <p className="mt-1.5 text-[10px] text-slate-500">
                {form.stayKind === 'day_use'
                  ? 'Same-day stay for a set window (e.g. 6 hours). Blocks the room for that date.'
                  : 'Standard multi-night stay with check-in and check-out dates.'}
              </p>
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
                    Use the room rate, or set a custom amount for this reservation.
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
                          String(
                            prev.stayKind === 'day_use'
                              ? Number(prev.rate) || 0
                              : defaultStayTotal || Number(prev.rate) || 0,
                          ),
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
                      placeholder={String(defaultStayTotal || rate || 0)}
                    />
                  </div>
                </FieldLabel>
              )}
              <p className="text-[10px] text-slate-500">
                {form.priceMode === 'default'
                  ? form.stayKind === 'day_use'
                    ? `Using ${formatMoney(stayTotal)} for this timed stay.`
                    : nights > 0
                      ? `${formatMoney(rate)} × ${nights} night${nights === 1 ? '' : 's'} = ${formatMoney(stayTotal)}.`
                      : 'Select valid dates to see the stay total.'
                  : `Custom total: ${formatMoney(stayTotal)}.`}
              </p>
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

            <div className="space-y-2 rounded-[11px] border border-amber-200/70 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Other charges
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Extra fees (minibar, damages, late checkout, etc.) — type what each is for.
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
                <p className="text-[11px] text-slate-500">No extra charges yet.</p>
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
                          placeholder="0"
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
                {!invalidDates && (form.stayKind === 'day_use' || nights > 0)
                  ? `${formatMoney(total)}${
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

            <div className="space-y-2 rounded-[11px] border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-900/50 dark:bg-sky-950/20 sm:col-span-2">
              <div className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-sky-600" />
                <div>
                  <p className="text-xs font-bold text-sky-800 dark:text-sky-200">
                    Booking attachments
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Add Booking.com screenshots or other proof. Admin-only.
                  </p>
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700">
                {uploadingEvidence ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploadingEvidence ? 'Uploading…' : 'Upload screenshots'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingEvidence}
                  className="hidden"
                  onChange={(event) => {
                    const files = event.target.files;
                    event.target.value = '';
                    void uploadEvidence(files);
                  }}
                />
              </label>
              {evidenceUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {evidenceUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-[8px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Evidence ${index + 1}`}
                        className="aspect-square w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEvidenceUrls((current) => current.filter((item) => item !== url))
                        }
                        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"
                        aria-label={`Remove evidence ${index + 1}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              disabled={saving || uploadingEvidence || blocked || invalidDates || rooms.length === 0}
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
