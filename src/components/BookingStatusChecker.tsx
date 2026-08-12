'use client';

import { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_MESSAGE,
  type BookingStatus,
  type PublicBookingStatus,
} from '@/lib/types/booking';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type BookingStatusCheckerProps = {
  /** Visual tone for landing (light) vs booking pages (dark). */
  tone?: 'light' | 'dark';
  className?: string;
  id?: string;
};

export function BookingStatusChecker({
  tone = 'light',
  className,
  id,
}: BookingStatusCheckerProps) {
  const [bookingCode, setBookingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<PublicBookingStatus | null>(null);
  const [error, setError] = useState('');

  const dark = tone === 'dark';

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setBooking(null);
    try {
      const res = await fetch('/api/booking-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingCode }),
      });
      const json = (await res.json()) as {
        booking?: PublicBookingStatus;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Lookup failed');
      if (!json.booking) throw new Error('No booking found');
      setBooking(json.booking);
      toast.success('Booking found', {
        description: `Status: ${BOOKING_STATUS_LABEL[json.booking.status]}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lookup failed';
      setError(message);
      toast.error('Could not find booking', { description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id={id} className={cn('w-full', className)}>
      <form onSubmit={(e) => void lookup(e)} className="space-y-4">
        <div>
          <label
            className={cn(
              'mb-2 block text-sm',
              dark ? 'text-white/80' : 'text-[#0a1628]/70',
            )}
          >
            Booking reference
          </label>
          <input
            required
            value={bookingCode}
            onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
            placeholder="e.g. BK4821 or EV4821"
            className={cn(
              'w-full rounded-xl border px-4 py-3 uppercase focus:outline-none',
              dark
                ? 'border-white/20 bg-white/10 text-white placeholder:text-white/35 focus:border-accent'
                : 'border-[#0a1628]/12 bg-white text-[#0a1628] placeholder:text-[#0a1628]/35 focus:border-accent',
            )}
          />
        </div>

        {error && (
          <p
            className={cn(
              'rounded-xl border px-4 py-3 text-sm',
              dark
                ? 'border-red-400/40 bg-red-500/15 text-red-200'
                : 'border-red-200 bg-red-50 text-red-600',
            )}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Checking…' : 'Check status'}
        </button>
      </form>

      {booking && (
        <div
          className={cn(
            'mt-6 rounded-2xl border p-5',
            dark ? 'border-white/15 bg-white/5' : 'border-[#0a1628]/8 bg-[#f8fafc]',
          )}
        >
          <StatusBadge status={booking.status} />
          <p
            className={cn(
              'mt-4 text-lg font-bold',
              dark ? 'text-white' : 'text-[#0a1628]',
            )}
          >
            {booking.booking_code}
          </p>
          <p className={cn('text-sm', dark ? 'text-white/70' : 'text-[#0a1628]/60')}>
            {booking.name}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className={cn(dark ? 'text-white/45' : 'text-[#0a1628]/45')}>
                {booking.kind === 'event' ? 'Event' : 'Room'}
              </dt>
              <dd className={cn('font-medium', dark ? 'text-white' : 'text-[#0a1628]')}>
                {booking.destination}
              </dd>
            </div>
            <div>
              <dt className={cn(dark ? 'text-white/45' : 'text-[#0a1628]/45')}>Email</dt>
              <dd
                className={cn(
                  'break-words font-medium',
                  dark ? 'text-white' : 'text-[#0a1628]',
                )}
              >
                {booking.email || '—'}
              </dd>
            </div>
            <div>
              <dt className={cn(dark ? 'text-white/45' : 'text-[#0a1628]/45')}>
                {booking.kind === 'event' ? 'Spots' : 'Guests'}
              </dt>
              <dd className={cn('font-medium', dark ? 'text-white' : 'text-[#0a1628]')}>
                {booking.kind === 'event'
                  ? `${booking.adults} guest${booking.adults === 1 ? '' : 's'}`
                  : `${booking.adults} adult${booking.adults === 1 ? '' : 's'}${
                      (booking.children ?? 0) > 0
                        ? ` · ${booking.children} child${booking.children === 1 ? '' : 'ren'}`
                        : ''
                    }`}
              </dd>
            </div>
            <div>
              <dt className={cn(dark ? 'text-white/45' : 'text-[#0a1628]/45')}>
                {booking.kind === 'event' ? 'From' : 'Check-in'}
              </dt>
              <dd className={cn('font-medium', dark ? 'text-white' : 'text-[#0a1628]')}>
                {formatDate(booking.check_in)}
              </dd>
            </div>
            <div>
              <dt className={cn(dark ? 'text-white/45' : 'text-[#0a1628]/45')}>
                {booking.kind === 'event' ? 'Until' : 'Check-out'}
              </dt>
              <dd className={cn('font-medium', dark ? 'text-white' : 'text-[#0a1628]')}>
                {formatDate(booking.check_out || booking.check_in)}
              </dd>
            </div>
          </dl>

          <p
            className={cn(
              'mt-5 text-xs leading-relaxed',
              dark ? 'text-white/55' : 'text-[#0a1628]/55',
            )}
          >
            {BOOKING_STATUS_MESSAGE[booking.status]}
          </p>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize',
        status === 'confirmed' && 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
        status === 'pending' && 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
        status === 'declined' && 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
        status === 'cancelled' && 'bg-slate-500/15 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
        status === 'rescheduled' && 'bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
      )}
    >
      {status === 'confirmed' && <CheckCircle2 className="h-3.5 w-3.5" />}
      {status === 'pending' && <Clock className="h-3.5 w-3.5" />}
      {(status === 'declined' || status === 'cancelled') && <XCircle className="h-3.5 w-3.5" />}
      {status === 'rescheduled' && <CalendarClock className="h-3.5 w-3.5" />}
      {BOOKING_STATUS_LABEL[status]}
    </span>
  );
}
