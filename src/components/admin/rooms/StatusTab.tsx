'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useBookings, useInvalidateAdmin, useRooms } from '@/lib/admin/queries';
import { adminRoomsHref } from '@/lib/admin/rooms-hub';
import { roomImages, type Room } from '@/lib/types/room';
import {
  getRoomStatusForDate,
  ROOM_LIVE_STATUS_LABEL,
  todayIsoLocal,
  type RoomLiveStatus,
} from '@/lib/room-status';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logActivity } from '@/lib/admin/activity-log';

const STATUS_STYLES: Record<RoomLiveStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  reserved: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  occupied: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  unavailable: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const CARD_RING: Record<RoomLiveStatus, string> = {
  available: 'ring-emerald-200 dark:ring-emerald-900/50',
  reserved: 'ring-sky-200 dark:ring-sky-900/50',
  occupied: 'ring-amber-200 dark:ring-amber-900/50',
  unavailable: 'ring-slate-200 dark:ring-slate-700',
};

export function StatusTab() {
  const roomsQuery = useRooms();
  const bookingsQuery = useBookings();
  const invalidate = useInvalidateAdmin();
  const rooms = roomsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const [date, setDate] = useState(todayIsoLocal());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const cards = useMemo(
    () =>
      [...rooms]
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((room) => ({
          room,
          ...getRoomStatusForDate(room, bookings, date),
        })),
    [rooms, bookings, date],
  );

  const counts = useMemo(() => {
    const init: Record<RoomLiveStatus, number> = {
      available: 0,
      reserved: 0,
      occupied: 0,
      unavailable: 0,
    };
    for (const c of cards) init[c.status] += 1;
    return init;
  }, [cards]);

  const toggleUnavailable = async (room: Room) => {
    setUpdatingId(room.id);
    try {
      const next = room.availability === 'unavailable' ? 'open' : 'unavailable';
      const supabase = createClient();
      const { error } = await supabase
        .from('rooms')
        .update({ availability: next })
        .eq('id', room.id);
      if (error) throw error;
      await logActivity({
        action: 'updated',
        entity: 'room',
        entityId: room.id,
        summary: `Marked room “${room.name}” ${next === 'unavailable' ? 'unavailable' : 'open'}`,
      });
      await invalidate(['rooms', 'activity']);
      toast.success(next === 'unavailable' ? 'Room marked unavailable' : 'Room marked open', {
        description: room.name,
      });
    } catch (err) {
      toast.error('Could not update availability', {
        description: err instanceof Error ? err.message : 'Update failed',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const loading =
    (roomsQuery.isPending && !roomsQuery.data) ||
    (bookingsQuery.isPending && !bookingsQuery.data);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[13px] admin-hairline bg-white p-4 dark:bg-slate-900 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#0a1628] dark:text-slate-100">Room status</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Occupancy for a selected date from confirmed bookings, plus manual blocks.
          </p>
        </div>
        <label className="block shrink-0">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[9px] admin-hairline px-3 py-2 text-sm dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(counts) as RoomLiveStatus[]).map((key) => (
          <span
            key={key}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
              STATUS_STYLES[key],
            )}
          >
            {ROOM_LIVE_STATUS_LABEL[key]}
            <span className="tabular-nums opacity-80">{counts[key]}</span>
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-[13px] admin-hairline bg-white px-6 py-12 text-center text-sm text-slate-500 dark:bg-slate-900">
          No rooms yet. Add rooms first, then check status here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ room, status, booking }) => {
            const photos = roomImages(room);
            return (
              <article
                key={room.id}
                className={cn(
                  'overflow-hidden rounded-[13px] admin-hairline bg-white ring-1 dark:bg-slate-900',
                  CARD_RING[status],
                )}
              >
                <div className="relative h-36 bg-slate-100 dark:bg-slate-800">
                  {photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photos[0]}
                      alt={room.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <span
                    className={cn(
                      'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      STATUS_STYLES[status],
                    )}
                  >
                    {ROOM_LIVE_STATUS_LABEL[status]}
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="font-bold text-[#0a1628] dark:text-slate-100">{room.name}</h3>
                    <p className="text-xs text-slate-500">
                      {room.category || 'Standard'} · up to {room.capacity} guests
                    </p>
                  </div>

                  {booking ? (
                    <div className="rounded-[9px] bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {booking.name}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        {booking.booking_code} · {booking.check_in} → {booking.check_out}
                      </p>
                      <Link
                        href={adminRoomsHref('bookings', { booking: booking.id })}
                        className="mt-1.5 inline-block font-semibold text-accent hover:underline"
                      >
                        Open booking
                      </Link>
                    </div>
                  ) : status === 'unavailable' ? (
                    <p className="text-xs text-slate-500">
                      Manually blocked (maintenance / closed).
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">No confirmed stay on this date.</p>
                  )}

                  <button
                    type="button"
                    disabled={updatingId === room.id}
                    onClick={() => void toggleUnavailable(room)}
                    className={cn(
                      'w-full rounded-[8px] px-3 py-2 text-xs font-semibold transition disabled:opacity-60',
                      room.availability === 'unavailable'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                    )}
                  >
                    {updatingId === room.id
                      ? 'Updating…'
                      : room.availability === 'unavailable'
                        ? 'Mark open'
                        : 'Mark unavailable'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
