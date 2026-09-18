import type { Income } from '@/lib/types/accounting';
import type { Booking } from '@/lib/types/booking';
import type { EventBooking } from '@/lib/types/event-booking';

export type IncomeSource = 'room' | 'event' | 'pool' | 'other';

export const INCOME_SOURCE_LABEL: Record<IncomeSource, string> = {
  room: 'Room',
  event: 'Event',
  pool: 'Pool',
  other: 'Other',
};

/** Infer booking source from income title/notes (legacy rows included). */
export function inferIncomeSource(row: Pick<Income, 'title' | 'notes' | 'category' | 'booking_id'>): IncomeSource {
  const title = row.title.trim().toLowerCase();
  const notes = (row.notes ?? '').trim().toLowerCase();
  const haystack = `${title} ${notes}`;

  if (
    title.startsWith('pool ') ||
    title.includes('pool walk-in') ||
    title.includes('pool payment') ||
    (/\bpool\b/.test(haystack) && (title.includes('walk-in') || title.includes('payment')))
  ) {
    return 'pool';
  }

  // Legacy event-titled rows that were really day-use swim packages
  if (
    (title.startsWith('event ') || title.includes('event walk-in')) &&
    /\b(pool|swim|swimming)\b/.test(haystack)
  ) {
    return 'pool';
  }

  if (
    title.startsWith('event ') ||
    title.includes('event walk-in') ||
    title.includes('event payment')
  ) {
    return 'event';
  }

  if (
    row.booking_id ||
    title.startsWith('booking ') ||
    title.startsWith('walk-in ')
  ) {
    return 'room';
  }

  if (row.category === 'booking') {
    if (/\broom\b|\bstay\b|\bcheck-?in\b/.test(haystack)) return 'room';
    return 'other';
  }

  return 'other';
}

export const INCOME_SOURCE_BADGE: Record<IncomeSource, string> = {
  room: 'bg-sky-100 text-sky-800 ring-sky-200/80 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900/40',
  event:
    'bg-violet-100 text-violet-800 ring-violet-200/80 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900/40',
  pool: 'bg-teal-100 text-teal-800 ring-teal-200/80 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-900/40',
  other:
    'bg-slate-100 text-slate-600 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
};

export function extractIncomeBookingCode(title: string): string | null {
  const match = title.match(
    /(?:event walk-in|pool walk-in|event payment|pool payment|walk-in|booking|event|pool)\s+([A-Za-z0-9]+)/i,
  );
  return match?.[1]?.toUpperCase() ?? null;
}

function guestsFromNotes(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const match = notes.match(/(\d+)\s*guests?\b/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Resolve guest count from linked bookings, then notes. */
export function resolveIncomeGuests(
  row: Pick<Income, 'title' | 'notes' | 'booking_id'>,
  roomById: Map<string, Booking>,
  roomByCode: Map<string, Booking>,
  eventByCode: Map<string, EventBooking>,
): number | null {
  if (row.booking_id) {
    const room = roomById.get(row.booking_id);
    if (room) {
      const total = (Number(room.adults) || 0) + (Number(room.children) || 0);
      if (total > 0) return total;
    }
  }

  const code = extractIncomeBookingCode(row.title);
  if (code) {
    const event = eventByCode.get(code);
    if (event && Number(event.guests) > 0) return Number(event.guests);
    const room = roomByCode.get(code);
    if (room) {
      const total = (Number(room.adults) || 0) + (Number(room.children) || 0);
      if (total > 0) return total;
    }
  }

  return guestsFromNotes(row.notes);
}

export function formatGuestCount(count: number | null | undefined) {
  if (count == null || count <= 0) return null;
  return `${count} guest${count === 1 ? '' : 's'}`;
}
