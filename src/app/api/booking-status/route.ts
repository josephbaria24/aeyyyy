import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBookingStatus } from '@/lib/types/booking';

function getSupabaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

type Body = {
  bookingCode?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const bookingCode = body.bookingCode?.trim().toUpperCase() ?? '';

    if (!bookingCode) {
      return NextResponse.json({ error: 'Booking code is required.' }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Server is missing Supabase credentials.' },
        { status: 500 },
      );
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('bookings')
      .select(
        'booking_code, status, name, email, destination, check_in, check_out, adults, children, rooms, created_at',
      )
      .eq('booking_code', bookingCode)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
      const status = isBookingStatus(data.status) ? data.status : 'pending';
      return NextResponse.json({
        booking: {
          ...data,
          status,
          children: data.children ?? 0,
          kind: 'room',
        },
      });
    }

    const { data: eventRow, error: eventError } = await supabase
      .from('event_bookings')
      .select(
        'booking_code, status, name, email, event_title, event_date, event_end_date, guests, created_at',
      )
      .eq('booking_code', bookingCode)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    if (!eventRow) {
      return NextResponse.json(
        { error: 'No booking found for that code.' },
        { status: 404 },
      );
    }

    const status = isBookingStatus(eventRow.status) ? eventRow.status : 'pending';
    const eventDate = eventRow.event_date ?? '';
    const eventEnd = eventRow.event_end_date ?? eventDate;

    return NextResponse.json({
      booking: {
        booking_code: eventRow.booking_code,
        status,
        name: eventRow.name,
        email: eventRow.email,
        destination: eventRow.event_title,
        check_in: eventDate,
        check_out: eventEnd,
        adults: Number(eventRow.guests) || 1,
        children: 0,
        rooms: 1,
        created_at: eventRow.created_at,
        kind: 'event',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
