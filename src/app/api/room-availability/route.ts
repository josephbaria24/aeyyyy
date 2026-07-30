import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
 * Public occupancy windows for the booking form.
 * Returns confirmed stays only (destination + dates) — no guest PII.
 */
export async function GET() {
  try {
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

    const from = todayIso();
    const { data, error } = await supabase
      .from('bookings')
      .select('destination, check_in, check_out')
      .eq('status', 'confirmed')
      .gte('check_out', from)
      .order('check_in', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stays = ((data as { destination: string; check_in: string; check_out: string }[]) ?? [])
      .filter((row) => row.destination && row.check_in && row.check_out)
      .map((row) => ({
        destination: String(row.destination),
        check_in: String(row.check_in).slice(0, 10),
        check_out: String(row.check_out).slice(0, 10),
      }));

    return NextResponse.json(
      { stays },
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
