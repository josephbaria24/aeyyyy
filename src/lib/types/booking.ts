export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'cancelled'
  | 'rescheduled';

export const BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'declined',
  'cancelled',
  'rescheduled',
];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

export const BOOKING_STATUS_MESSAGE: Record<BookingStatus, string> = {
  pending:
    'Still waiting for the inn team to review. Check again later, or wait for a call/email from reception.',
  confirmed:
    'Your stay is approved. Show your reference image or this confirmation at reception.',
  declined:
    'This request was declined. Contact the inn if you would like to book different dates or another room.',
  cancelled:
    'This request was cancelled. Contact the inn if you think this is a mistake.',
  rescheduled:
    'Your booking was rescheduled. Please confirm the new dates with reception using your booking code.',
};

/** Extra payable line (damages, minibar, etc.). */
export type BookingCharge = {
  id: string;
  label: string;
  amount: number;
};

export type Booking = {
  id: string;
  booking_code: string;
  name: string;
  email: string;
  phone: string | null;
  destination: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms: number;
  requests: string | null;
  status: BookingStatus;
  /** Stay subtotal (rate × nights × rooms). */
  amount: number;
  rate_per_night: number;
  amount_paid: number;
  other_charges: BookingCharge[];
  currency: string;
  notes: string | null;
  created_at: string;
};

export type BookingInsert = {
  booking_code: string;
  name: string;
  email: string;
  phone?: string | null;
  destination: string;
  check_in: string;
  check_out: string;
  adults: number;
  children?: number;
  rooms: number;
  requests?: string | null;
  status?: BookingStatus;
  amount?: number;
  rate_per_night?: number;
  amount_paid?: number;
  other_charges?: BookingCharge[];
  currency?: string;
  notes?: string | null;
};

export type PublicBookingStatus = {
  booking_code: string;
  status: BookingStatus;
  name: string;
  email: string;
  destination: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number | null;
  rooms: number;
  created_at: string;
};

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as string[]).includes(value);
}

export function normalizeCharges(raw: unknown): BookingCharge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const label = String(row.label ?? '').trim();
      const amount = Number(row.amount) || 0;
      if (!label && amount <= 0) return null;
      return {
        id: String(row.id ?? `charge-${index}`),
        label: label || 'Other charge',
        amount,
      };
    })
    .filter((c): c is BookingCharge => Boolean(c));
}

export function otherChargesTotal(charges: BookingCharge[] | unknown) {
  return normalizeCharges(charges).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

export function bookingStayTotal(booking: {
  amount?: number | null;
  rate_per_night?: number | null;
  check_in?: string;
  check_out?: string;
  rooms?: number | null;
}) {
  const saved = Number(booking.amount) || 0;
  if (saved > 0) return saved;
  return 0;
}

export function bookingGrandTotal(booking: {
  amount?: number | null;
  amount_paid?: number | null;
  other_charges?: BookingCharge[] | unknown;
}) {
  const stay = Number(booking.amount) || 0;
  const extras = otherChargesTotal(booking.other_charges);
  return Math.round((stay + extras) * 100) / 100;
}

export function bookingUnpaid(booking: {
  amount?: number | null;
  amount_paid?: number | null;
  other_charges?: BookingCharge[] | unknown;
}) {
  const due = bookingGrandTotal(booking);
  const paid = Number(booking.amount_paid) || 0;
  return Math.max(0, Math.round((due - paid) * 100) / 100);
}

export function newChargeId() {
  return `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeBooking(row: Partial<Booking> & Record<string, unknown>): Booking {
  return {
    id: String(row.id ?? ''),
    booking_code: String(row.booking_code ?? ''),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: (row.phone as string | null) ?? null,
    destination: String(row.destination ?? ''),
    check_in: String(row.check_in ?? ''),
    check_out: String(row.check_out ?? ''),
    adults: Number(row.adults) || 1,
    children: Number(row.children) || 0,
    rooms: Number(row.rooms) || 1,
    requests: (row.requests as string | null) ?? null,
    status: isBookingStatus(String(row.status ?? '')) ? (row.status as BookingStatus) : 'pending',
    amount: Number(row.amount) || 0,
    rate_per_night: Number(row.rate_per_night) || 0,
    amount_paid: Number(row.amount_paid) || 0,
    other_charges: normalizeCharges(row.other_charges),
    currency: String(row.currency ?? 'PHP'),
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  };
}
