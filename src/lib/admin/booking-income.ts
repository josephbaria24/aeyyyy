import type { SupabaseClient } from '@supabase/supabase-js';
import { SYSTEM_CURRENCY } from '@/lib/money';
import { bookingGrandTotal, type Booking } from '@/lib/types/booking';

type IncomeRow = {
  id: string;
  amount: number;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function todayIsoLocal() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Keep booking income equal to cumulative amount_paid.
 *
 * New payments add only the difference. Corrections that lower amount_paid
 * reduce the newest generated income rows, preventing duplicate revenue.
 */
export async function syncBookingIncome(
  supabase: SupabaseClient,
  booking: Booking,
  amountPaid: number,
) {
  const target = money(Math.max(0, amountPaid));
  const { data, error } = await supabase
    .from('income')
    .select('id, amount')
    .eq('booking_id', booking.id)
    .eq('category', 'booking')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = ((data ?? []) as IncomeRow[]).map((row) => ({
    ...row,
    amount: money(Number(row.amount) || 0),
  }));
  const recorded = money(rows.reduce((sum, row) => sum + row.amount, 0));
  const difference = money(target - recorded);

  if (difference > 0) {
    const { error: insertError } = await supabase.from('income').insert({
      title: `Booking ${booking.booking_code} — ${booking.name}`,
      category: 'booking',
      amount: difference,
      currency: booking.currency || SYSTEM_CURRENCY,
      // Attribute booking revenue to the stay month, not the date it was entered.
      income_date: booking.check_in || todayIsoLocal(),
      booking_id: booking.id,
      notes: `${booking.destination} (${booking.check_in} to ${booking.check_out}) · cumulative payment ${target} / due ${bookingGrandTotal(booking)}`,
    });
    if (insertError) throw insertError;
    return { changed: true, difference };
  }

  if (difference < 0) {
    let remainingReduction = Math.abs(difference);

    for (const row of rows) {
      if (remainingReduction <= 0) break;

      if (row.amount <= remainingReduction) {
        const { error: deleteError } = await supabase
          .from('income')
          .delete()
          .eq('id', row.id);
        if (deleteError) throw deleteError;
        remainingReduction = money(remainingReduction - row.amount);
      } else {
        const { error: updateError } = await supabase
          .from('income')
          .update({ amount: money(row.amount - remainingReduction) })
          .eq('id', row.id);
        if (updateError) throw updateError;
        remainingReduction = 0;
      }
    }

    return { changed: true, difference };
  }

  return { changed: false, difference: 0 };
}
