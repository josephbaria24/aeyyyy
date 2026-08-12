import { isBookingStatus, type BookingStatus } from '@/lib/types/booking';

export type EventBooking = {
  id: string;
  booking_code: string;
  event_id: string | null;
  offering_id: string | null;
  event_title: string;
  event_date: string | null;
  event_end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  name: string;
  email: string;
  phone: string | null;
  guests: number;
  requests: string | null;
  status: BookingStatus;
  amount: number;
  amount_paid: number;
  currency: string;
  notes: string | null;
  linked_room_booking_id: string | null;
  linked_room_code: string | null;
  created_at: string;
};

export function makeEventBookingCode() {
  return `EV${Math.floor(1000 + Math.random() * 9000)}`;
}

export function eventBookingUnpaid(booking: { amount?: number | null; amount_paid?: number | null }) {
  const due = Number(booking.amount) || 0;
  const paid = Number(booking.amount_paid) || 0;
  return Math.max(0, Math.round((due - paid) * 100) / 100);
}

/** Build /book URL that prefills guest details from an event reservation. */
export function roomBookingHrefFromEvent(opts: {
  eventBookingId: string;
  eventCode: string;
  name: string;
  email: string;
  phone?: string | null;
  startDate: string;
  endDate: string;
  guests: number;
}) {
  const params = new URLSearchParams();
  params.set('eventBookingId', opts.eventBookingId);
  params.set('eventCode', opts.eventCode);
  if (opts.name) params.set('name', opts.name);
  if (opts.email) params.set('email', opts.email);
  if (opts.phone) params.set('phone', opts.phone);
  if (opts.startDate) params.set('checkIn', opts.startDate);
  if (opts.endDate) {
    // Room check-out is the morning after the last event day (half-open stay).
    const d = new Date(`${opts.endDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    params.set('checkOut', `${y}-${m}-${day}`);
  }
  if (opts.guests > 0) params.set('adults', String(opts.guests));
  return `/book?${params.toString()}`;
}

export function normalizeEventBooking(
  row: Partial<EventBooking> & Record<string, unknown>,
): EventBooking {
  return {
    id: String(row.id ?? ''),
    booking_code: String(row.booking_code ?? ''),
    event_id: row.event_id ? String(row.event_id) : null,
    offering_id: row.offering_id ? String(row.offering_id) : null,
    event_title: String(row.event_title ?? ''),
    event_date: (row.event_date as string | null) ?? null,
    event_end_date: (row.event_end_date as string | null) ?? null,
    start_time: typeof row.start_time === 'string' ? row.start_time.slice(0, 5) : null,
    end_time: typeof row.end_time === 'string' ? row.end_time.slice(0, 5) : null,
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: (row.phone as string | null) ?? null,
    guests: Math.max(1, Number(row.guests) || 1),
    requests: (row.requests as string | null) ?? null,
    status: isBookingStatus(String(row.status ?? '')) ? (row.status as BookingStatus) : 'pending',
    amount: Number(row.amount) || 0,
    amount_paid: Number(row.amount_paid) || 0,
    currency: String(row.currency ?? 'PHP'),
    notes: (row.notes as string | null) ?? null,
    linked_room_booking_id: row.linked_room_booking_id
      ? String(row.linked_room_booking_id)
      : null,
    linked_room_code: row.linked_room_code ? String(row.linked_room_code) : null,
    created_at: String(row.created_at ?? ''),
  };
}
