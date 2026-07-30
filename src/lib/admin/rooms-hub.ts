export type RoomsHubTab = 'rooms' | 'status' | 'calendar' | 'bookings' | 'guests';

export function adminRoomsHref(
  tab: RoomsHubTab = 'rooms',
  opts?: { guest?: string; booking?: string },
) {
  const params = new URLSearchParams();
  if (tab !== 'rooms') params.set('tab', tab);
  if (opts?.guest) params.set('guest', opts.guest);
  if (opts?.booking) params.set('booking', opts.booking);
  const q = params.toString();
  return q ? `/admin/rooms?${q}` : '/admin/rooms';
}

export function parseRoomsHubTab(value: string | null): RoomsHubTab {
  if (
    value === 'bookings' ||
    value === 'guests' ||
    value === 'status' ||
    value === 'calendar'
  ) {
    return value;
  }
  return 'rooms';
}
