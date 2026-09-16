'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  bookingGrandTotal,
  bookingUnpaid,
  newChargeId,
  normalizeCharges,
  type Booking,
  type BookingCharge,
} from '@/lib/types/booking';
import {
  calculateStayAmount,
  formatMoney,
  nightsBetween,
  SYSTEM_CURRENCY_SYMBOL,
} from '@/lib/money';
import type { Room } from '@/lib/types/room';
import { cn } from '@/lib/utils';

export type PaymentDraft = {
  rate_per_night: string;
  amount: string;
  amount_paid: string;
  other_charges: BookingCharge[];
};

export function draftFromBooking(booking: Booking, rooms: Room[]): PaymentDraft {
  const matched = rooms.find(
    (r) => r.name.toLowerCase() === booking.destination.trim().toLowerCase(),
  );
  const rate =
    Number(booking.rate_per_night) > 0
      ? Number(booking.rate_per_night)
      : Number(matched?.price_per_night) || 0;
  const stay =
    Number(booking.amount) > 0
      ? Number(booking.amount)
      : calculateStayAmount(rate, booking.check_in, booking.check_out, Number(booking.rooms) || 1);

  return {
    rate_per_night: String(rate),
    amount: String(stay),
    amount_paid: String(Number(booking.amount_paid) || 0),
    other_charges: normalizeCharges(booking.other_charges),
  };
}

type BookingPaymentEditorProps = {
  booking: Booking;
  rooms: Room[];
  draft: PaymentDraft;
  onChange: (next: PaymentDraft) => void;
  onSave: () => void;
  saving?: boolean;
  className?: string;
};

function MoneyInput({
  label,
  value,
  onChange,
  readOnly,
  className,
}: {
  label: string;
  value: string | number;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('block min-w-0 w-full', className)}>
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="relative">
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
          {SYSTEM_CURRENCY_SYMBOL}
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          readOnly={readOnly}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'box-border w-full min-w-0 rounded-[5px] admin-hairline py-1 pl-5 pr-1.5 text-xs',
            readOnly && 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',
          )}
        />
      </div>
    </label>
  );
}

export function BookingPaymentEditor({
  booking,
  rooms,
  draft,
  onChange,
  onSave,
  saving,
  className,
}: BookingPaymentEditorProps) {
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const stay = Number(draft.amount) || 0;
  const paid = Number(draft.amount_paid) || 0;
  const preview = {
    amount: stay,
    amount_paid: paid,
    other_charges: draft.other_charges,
  };
  const unpaid = bookingUnpaid(preview);
  const extras = bookingGrandTotal(preview) - stay;

  const recalcStay = () => {
    const matched = rooms.find(
      (r) => r.name.toLowerCase() === booking.destination.trim().toLowerCase(),
    );
    const nextRate =
      Number(draft.rate_per_night) > 0
        ? Number(draft.rate_per_night)
        : Number(matched?.price_per_night) || 0;
    const nextStay = calculateStayAmount(
      nextRate,
      booking.check_in,
      booking.check_out,
      Number(booking.rooms) || 1,
    );
    onChange({
      ...draft,
      rate_per_night: String(nextRate),
      amount: String(nextStay),
    });
  };

  const updateCharge = (id: string, patch: Partial<BookingCharge>) => {
    onChange({
      ...draft,
      other_charges: draft.other_charges.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const addCharge = () => {
    onChange({
      ...draft,
      other_charges: [...draft.other_charges, { id: newChargeId(), label: '', amount: 0 }],
    });
  };

  const removeCharge = (id: string) => {
    onChange({
      ...draft,
      other_charges: draft.other_charges.filter((c) => c.id !== id),
    });
  };

  return (
    <div className={cn('w-full min-w-0 max-w-full space-y-2', className)}>
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-3 xl:grid-cols-[repeat(5,minmax(80px,1fr))_auto]">
        <MoneyInput
          label="Rate / night"
          value={draft.rate_per_night}
          onChange={(nextRate) => {
            const nextStay = calculateStayAmount(
              Number(nextRate) || 0,
              booking.check_in,
              booking.check_out,
              Number(booking.rooms) || 1,
            );
            onChange({
              ...draft,
              rate_per_night: nextRate,
              amount: String(nextStay),
            });
          }}
        />
        <MoneyInput
          label={`Stay (${nights || 0}n)`}
          value={draft.amount}
          onChange={(v) => onChange({ ...draft, amount: v })}
        />
        <MoneyInput
          label="Paid"
          value={draft.amount_paid}
          onChange={(v) => onChange({ ...draft, amount_paid: v })}
        />
        <MoneyInput
          label="Unpaid"
          value={unpaid}
          readOnly
          className={unpaid > 0 ? '[&_input]:text-rose-600' : '[&_input]:text-emerald-600'}
        />
        <MoneyInput label="Extras" value={extras} readOnly />

        <div className="col-span-2 flex items-center justify-end gap-1.5 sm:col-span-3 xl:col-span-1">
          <button
            type="button"
            onClick={recalcStay}
            title="Auto-calc stay from room rate × nights"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-8 rounded-[6px] bg-[#0a1628] px-3 text-xs font-semibold text-white hover:bg-[#12243d] disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Other
        </span>
        {draft.other_charges.map((charge) => (
          <div
            key={charge.id}
            className="flex w-full min-w-0 max-w-full items-center gap-1 rounded-[5px] border border-slate-200 bg-white px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900 sm:w-auto"
          >
            <input
              type="text"
              placeholder="Item"
              value={charge.label}
              onChange={(e) => updateCharge(charge.id, { label: e.target.value })}
              className="min-w-0 flex-1 border-0 bg-transparent px-1 py-0.5 text-[11px] outline-none sm:w-20"
            />
            <div className="relative w-16">
              <span className="pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">
                {SYSTEM_CURRENCY_SYMBOL}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={charge.amount}
                onChange={(e) =>
                  updateCharge(charge.id, { amount: Number(e.target.value) || 0 })
                }
                className="w-full border-0 bg-transparent py-0.5 pl-3.5 pr-0.5 text-[11px] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => removeCharge(charge.id)}
              className="rounded p-0.5 text-slate-400 hover:text-rose-600"
              aria-label="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addCharge}
          className="inline-flex items-center gap-0.5 rounded-[5px] px-1.5 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/5"
        >
          <Plus className="h-3 w-3" /> Add payable
        </button>
        <span className="text-[10px] text-slate-400">
          Due {formatMoney(bookingGrandTotal(preview))}
        </span>
      </div>
    </div>
  );
}

export function usePaymentDrafts(bookings: Booking[], rooms: Room[]) {
  const [drafts, setDrafts] = useState<Record<string, PaymentDraft>>({});

  const signature = useMemo(
    () =>
      bookings
        .map(
          (b) =>
            `${b.id}:${b.amount}:${b.rate_per_night}:${b.amount_paid}:${JSON.stringify(b.other_charges)}`,
        )
        .join('|'),
    [bookings],
  );

  useEffect(() => {
    setDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const booking of bookings) {
        if (!next[booking.id]) {
          next[booking.id] = draftFromBooking(booking, rooms);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [signature, bookings, rooms]);

  const ensureDraft = (booking: Booking) =>
    drafts[booking.id] ?? draftFromBooking(booking, rooms);

  return { drafts, setDrafts, ensureDraft };
}
