import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { eventStayWindow } from '@/lib/event-status';

function getSupabaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Public occupancy for event areas (and optional dated-event capacity).
 * Returns stay windows only — no guest PII.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId')?.trim() ?? '';
    const offeringId = searchParams.get('offeringId')?.trim() ?? '';

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

    if (eventId) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title, is_bookable, capacity, price, is_active')
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) {
        return NextResponse.json({ error: eventError.message }, { status: 500 });
      }
      if (!event) {
        return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
      }

      const { data: rows, error: bookingError } = await supabase
        .from('event_bookings')
        .select('guests, status')
        .eq('event_id', eventId)
        .in('status', ['pending', 'confirmed']);

      if (bookingError) {
        return NextResponse.json({ error: bookingError.message }, { status: 500 });
      }

      const booked = (rows ?? []).reduce((sum, row) => sum + (Number(row.guests) || 0), 0);
      const capacity = Math.max(0, Number(event.capacity) || 0);
      const remaining = capacity > 0 ? Math.max(0, capacity - booked) : null;

      return NextResponse.json({
        eventId: event.id,
        title: event.title,
        is_bookable: Boolean(event.is_bookable) && Boolean(event.is_active),
        capacity,
        price: Number(event.price) || 0,
        booked,
        remaining,
      });
    }

    const from = todayIso();
    let bookingsQuery = supabase
      .from('event_bookings')
      .select('offering_id, event_date, event_end_date, status')
      .in('status', ['pending', 'confirmed'])
      .not('offering_id', 'is', null)
      .not('event_date', 'is', null)
      .order('event_date', { ascending: true });

    if (offeringId) bookingsQuery = bookingsQuery.eq('offering_id', offeringId);

    const { data: rows, error: bookingError } = await bookingsQuery;
    if (bookingError) {
      return NextResponse.json({ error: bookingError.message }, { status: 500 });
    }

    const stays = (rows ?? [])
      .map((row) => {
        const window = eventStayWindow({
          event_date: row.event_date as string | null,
          event_end_date: row.event_end_date as string | null,
        });
        if (!window || window.check_out < from) return null;
        return {
          offeringId: String(row.offering_id),
          destination: String(row.offering_id),
          check_in: window.check_in,
          check_out: window.check_out,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    let unavailableQuery = supabase
      .from('event_offerings')
      .select('id')
      .eq('availability', 'unavailable');
    if (offeringId) unavailableQuery = unavailableQuery.eq('id', offeringId);

    const { data: closed } = await unavailableQuery;
    const unavailable = (closed ?? []).map((row) => String(row.id));

    return NextResponse.json(
      { stays, unavailable },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
