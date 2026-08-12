export type EventsHubTab = 'bookings' | 'status' | 'calendar' | 'areas';

export function adminEventsHref(
  tab: EventsHubTab = 'bookings',
  opts?: { booking?: string },
) {
  const params = new URLSearchParams();
  if (tab !== 'bookings') params.set('tab', tab);
  if (opts?.booking) params.set('booking', opts.booking);
  const q = params.toString();
  return q ? `/admin/event-bookings?${q}` : '/admin/event-bookings';
}

export function parseEventsHubTab(value: string | null): EventsHubTab {
  if (value === 'status' || value === 'calendar' || value === 'areas' || value === 'bookings') {
    return value;
  }
  if (value === 'types' || value === 'reservations') return value === 'types' ? 'areas' : 'bookings';
  return 'bookings';
}
