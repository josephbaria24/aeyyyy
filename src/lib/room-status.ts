import type { Booking } from '@/lib/types/booking';
import type { Room } from '@/lib/types/room';

export type RoomLiveStatus = 'available' | 'reserved' | 'occupied' | 'unavailable';

export const ROOM_LIVE_STATUS_LABEL: Record<RoomLiveStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  occupied: 'Occupied',
  unavailable: 'Unavailable',
};

export type RoomStatusResult = {
  status: RoomLiveStatus;
  booking: Booking | null;
};

function toDateOnly(value: string | Date) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return value.slice(0, 10);
}

function roomMatchesBooking(room: Room, booking: Booking) {
  return room.name.trim().toLowerCase() === booking.destination.trim().toLowerCase();
}

/** Confirmed bookings for a room, sorted by check-in ascending. */
export function confirmedBookingsForRoom(room: Room, bookings: Booking[]) {
  return bookings
    .filter((b) => b.status === 'confirmed' && roomMatchesBooking(room, b))
    .sort((a, b) => a.check_in.localeCompare(b.check_in));
}

/**
 * Occupancy for a selected calendar date D only.
 * A stay in December does not mark earlier dates reserved.
 * - Unavailable: manual room.availability === 'unavailable'
 * - Occupied: confirmed stay covering D that has already started
 * - Reserved: confirmed stay covering D that starts after today
 * - Available: D is outside every confirmed stay
 */
export function getRoomStatusForDate(
  room: Room,
  bookings: Booking[],
  date: string | Date = new Date(),
): RoomStatusResult {
  if (room.availability === 'unavailable') {
    return { status: 'unavailable', booking: null };
  }

  const d = toDateOnly(date);
  const today = todayIsoLocal();
  const covering = confirmedBookingsForRoom(room, bookings).find(
    (b) => b.check_in <= d && d < b.check_out,
  );
  if (!covering) return { status: 'available', booking: null };
  if (covering.check_in > today) return { status: 'reserved', booking: covering };
  return { status: 'occupied', booking: covering };
}

export function todayIsoLocal(date = new Date()) {
  return toDateOnly(date);
}

/** Minimal confirmed stay window (public occupancy payload). */
export type OccupancyStay = {
  destination: string;
  check_in: string;
  check_out: string;
};

/** Hotel nights use half-open ranges [check_in, check_out). */
export function staysOverlap(
  checkInA: string,
  checkOutA: string,
  checkInB: string,
  checkOutB: string,
) {
  const aIn = toDateOnly(checkInA);
  const aOut = toDateOnly(checkOutA);
  const bIn = toDateOnly(checkInB);
  const bOut = toDateOnly(checkOutB);
  if (!aIn || !aOut || !bIn || !bOut) return false;
  if (aOut <= aIn || bOut <= bIn) return false;
  return aIn < bOut && bIn < aOut;
}

export function confirmedStaysForRoom(room: Room, stays: OccupancyStay[]) {
  const name = room.name.trim().toLowerCase();
  return stays
    .filter((s) => s.destination.trim().toLowerCase() === name)
    .sort((a, b) => a.check_in.localeCompare(b.check_in));
}

export type StayAvailability =
  | { kind: 'open' }
  | { kind: 'unavailable' }
  | { kind: 'conflict'; stay: OccupancyStay };

/**
 * Public booking form check for a proposed stay.
 * Manual blocks win; otherwise any overlapping confirmed stay is a conflict.
 */
export function getStayAvailability(
  room: Room | null | undefined,
  stays: OccupancyStay[],
  checkIn?: string,
  checkOut?: string,
): StayAvailability {
  if (!room) return { kind: 'open' };
  if (room.availability === 'unavailable') return { kind: 'unavailable' };

  const inDate = checkIn?.trim();
  const outDate = checkOut?.trim();
  if (!inDate || !outDate) return { kind: 'open' };

  const conflict = confirmedStaysForRoom(room, stays).find((s) =>
    staysOverlap(inDate, outDate, s.check_in, s.check_out),
  );
  if (conflict) return { kind: 'conflict', stay: conflict };
  return { kind: 'open' };
}

/** Live status from public occupancy stays (no guest PII). */
export function getRoomStatusFromOccupancy(
  room: Room,
  stays: OccupancyStay[],
  date: string | Date = new Date(),
): RoomLiveStatus {
  if (room.availability === 'unavailable') return 'unavailable';

  const d = toDateOnly(date);
  const today = todayIsoLocal();
  const covering = confirmedStaysForRoom(room, stays).find(
    (s) => s.check_in <= d && d < s.check_out,
  );
  if (!covering) return 'available';
  if (covering.check_in > today) return 'reserved';
  return 'occupied';
}
