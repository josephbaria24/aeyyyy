import type { EventBooking } from '@/lib/types/event-booking';
import type { EventOffering } from '@/lib/types/event-offering';

export type AreaLiveStatus = 'available' | 'reserved' | 'occupied' | 'unavailable';

export const AREA_LIVE_STATUS_LABEL: Record<AreaLiveStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  occupied: 'In use',
  unavailable: 'Unavailable',
};

export function todayIsoLocal(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayIsoLocal(d);
}

/** Inclusive event window → half-open stay used by occupancy calendars. */
export function eventStayWindow(booking: {
  event_date: string | null;
  event_end_date: string | null;
}) {
  const start = booking.event_date;
  if (!start) return null;
  const endInclusive = booking.event_end_date || start;
  return { check_in: start, check_out: addDaysIso(endInclusive, 1) };
}

export function eventCoversDate(booking: EventBooking, dayIso: string) {
  const start = booking.event_date;
  if (!start) return false;
  const end = booking.event_end_date || start;
  return start <= dayIso && dayIso <= end;
}

export function holdingEventBookings(bookings: EventBooking[], offeringId?: string) {
  return bookings.filter((b) => {
    if (b.status !== 'confirmed' && b.status !== 'pending') return false;
    if (offeringId && b.offering_id !== offeringId) return false;
    return Boolean(b.event_date);
  });
}

export function getAreaStatusForDate(
  area: EventOffering,
  bookings: EventBooking[],
  date: string,
): { status: AreaLiveStatus; booking: EventBooking | null } {
  if (area.availability === 'unavailable') {
    return { status: 'unavailable', booking: null };
  }

  const held = holdingEventBookings(bookings, area.id).sort(
    (a, b) => (a.event_date || '').localeCompare(b.event_date || ''),
  );

  const occupying = held.find((b) => b.status === 'confirmed' && eventCoversDate(b, date));
  if (occupying) return { status: 'occupied', booking: occupying };

  const reserved = held.find((b) => b.status === 'pending' && eventCoversDate(b, date));
  if (reserved) return { status: 'reserved', booking: reserved };

  const upcoming = held.find(
    (b) => b.status === 'confirmed' && (b.event_date || '') > date,
  );
  if (upcoming) return { status: 'reserved', booking: upcoming };

  return { status: 'available', booking: null };
}

export function areaRangeConflicts(
  bookings: EventBooking[],
  offeringId: string,
  start: string,
  end: string,
) {
  const held = holdingEventBookings(bookings, offeringId);
  return held.some((b) => {
    const bStart = b.event_date;
    if (!bStart) return false;
    const bEnd = b.event_end_date || bStart;
    return start <= bEnd && end >= bStart;
  });
}
