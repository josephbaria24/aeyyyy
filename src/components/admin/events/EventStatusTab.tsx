'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/admin/activity-log';
import { useEventBookings, useInvalidateAdmin, useOfferings } from '@/lib/admin/queries';
import { adminEventsHref } from '@/lib/admin/events-hub';
import {
  AREA_LIVE_STATUS_LABEL,
  getAreaStatusForDate,
  todayIsoLocal,
  type AreaLiveStatus,
} from '@/lib/event-status';
import { eventAreaImages, type EventOffering } from '@/lib/types/event-offering';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_STYLES: Record<AreaLiveStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  reserved: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  occupied: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  unavailable: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export function EventStatusTab() {
  const areasQuery = useOfferings();
  const bookingsQuery = useEventBookings();
  const invalidate = useInvalidateAdmin();
  const areas = areasQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const [date, setDate] = useState(todayIsoLocal());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const cards = useMemo(
    () =>
      [...areas]
        .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
        .map((area) => ({ area, ...getAreaStatusForDate(area, bookings, date) })),
    [areas, bookings, date],
  );

  const toggleUnavailable = async (area: EventOffering) => {
    setUpdatingId(area.id);
    try {
      const next = area.availability === 'unavailable' ? 'open' : 'unavailable';
      const supabase = createClient();
      const { error } = await supabase
        .from('event_offerings')
        .update({ availability: next })
        .eq('id', area.id);
      if (error) throw error;
      await logActivity({
        action: 'updated',
        entity: 'offering',
        entityId: area.id,
        summary: `Marked area “${area.title}” ${next === 'unavailable' ? 'unavailable' : 'open'}`,
      });
      await invalidate(['offerings', 'activity']);
      toast.success(next === 'unavailable' ? 'Area marked unavailable' : 'Area marked open', {
        description: area.title,
      });
    } catch (err) {
      toast.error('Could not update availability', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const loading =
    (areasQuery.isPending && !areasQuery.data) ||
    (bookingsQuery.isPending && !bookingsQuery.data);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[13px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Area availability</h2>
          <p className="text-sm text-slate-500">Open, reserved, in use, or manually closed for a date.</p>
        </div>
        <label className="text-xs font-semibold text-slate-500">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-[9px] admin-hairline px-3 py-2 text-sm dark:bg-slate-950"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ area, status, booking }) => {
          const photo = eventAreaImages(area)[0];
          return (
            <article
              key={area.id}
              className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900"
            >
              <div className="relative h-36 bg-slate-100 dark:bg-slate-800">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : null}
                <span
                  className={cn(
                    'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold',
                    STATUS_STYLES[status],
                  )}
                >
                  {AREA_LIVE_STATUS_LABEL[status]}
                </span>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{area.title}</p>
                  {booking && (
                    <Link
                      href={adminEventsHref('bookings', { booking: booking.id })}
                      className="mt-1 block text-xs text-slate-500 underline-offset-2 hover:underline"
                    >
                      {booking.booking_code} · {booking.name}
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  disabled={updatingId === area.id}
                  onClick={() => void toggleUnavailable(area)}
                  className="rounded-[8px] admin-hairline px-3 py-1.5 text-xs font-semibold"
                >
                  {updatingId === area.id
                    ? 'Saving…'
                    : area.availability === 'unavailable'
                      ? 'Mark available'
                      : 'Mark unavailable'}
                </button>
              </div>
            </article>
          );
        })}
        {cards.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-slate-500">
            Add an event area first.
          </p>
        )}
      </div>
    </div>
  );
}
