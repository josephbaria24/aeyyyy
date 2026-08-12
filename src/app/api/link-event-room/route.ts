import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

/**
 * After a guest books a room linked to an event, set the reverse link on the event.
 * Uses service role because anon cannot update event_bookings.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventBookingId?: string;
      eventCode?: string;
      roomBookingId?: string;
      roomCode?: string;
    };

    const eventBookingId = body.eventBookingId?.trim() ?? '';
    const eventCode = body.eventCode?.trim() ?? '';
    const roomBookingId = body.roomBookingId?.trim() ?? '';
    const roomCode = body.roomCode?.trim() ?? '';

    if (!eventBookingId || !eventCode || !roomBookingId) {
      return NextResponse.json(
        { error: 'eventBookingId, eventCode, and roomBookingId are required.' },
        { status: 400 },
      );
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

    const { data: eventBooking, error: eventError } = await supabase
      .from('event_bookings')
      .select('id, booking_code')
      .eq('id', eventBookingId)
      .eq('booking_code', eventCode)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }
    if (!eventBooking) {
      return NextResponse.json({ error: 'Event booking not found.' }, { status: 404 });
    }

    const { data: roomBooking, error: roomError } = await supabase
      .from('bookings')
      .select('id, booking_code')
      .eq('id', roomBookingId)
      .maybeSingle();

    if (roomError) {
      return NextResponse.json({ error: roomError.message }, { status: 500 });
    }
    if (!roomBooking) {
      return NextResponse.json({ error: 'Room booking not found.' }, { status: 404 });
    }

    const resolvedRoomCode = roomCode || roomBooking.booking_code;

    const { error: updateEventError } = await supabase
      .from('event_bookings')
      .update({
        linked_room_booking_id: roomBooking.id,
        linked_room_code: resolvedRoomCode,
      })
      .eq('id', eventBooking.id);

    if (updateEventError) {
      return NextResponse.json({ error: updateEventError.message }, { status: 500 });
    }

    const { error: updateRoomError } = await supabase
      .from('bookings')
      .update({
        linked_event_booking_id: eventBooking.id,
        linked_event_code: eventBooking.booking_code,
      })
      .eq('id', roomBooking.id);

    if (updateRoomError) {
      return NextResponse.json({ error: updateRoomError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      eventBookingId: eventBooking.id,
      roomBookingId: roomBooking.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Link failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
