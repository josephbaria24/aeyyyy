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

    if (!data) {
      return NextResponse.json(
        { error: 'No booking found for that code.' },
        { status: 404 },
      );
    }

    const status = isBookingStatus(data.status) ? data.status : 'pending';

    return NextResponse.json({
      booking: {
        ...data,
        status,
        children: data.children ?? 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
