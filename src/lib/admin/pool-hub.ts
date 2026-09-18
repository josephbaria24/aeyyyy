import {
  adminEventsHref,
  parseEventsHubTab,
  type EventsHubTab,
} from '@/lib/admin/events-hub';

export type PoolHubTab = EventsHubTab;

export function adminPoolHref(
  tab: PoolHubTab = 'bookings',
  opts?: { booking?: string },
) {
  const params = new URLSearchParams();
  if (tab !== 'bookings') params.set('tab', tab);
  if (opts?.booking) params.set('booking', opts.booking);
  const q = params.toString();
  return q ? `/admin/pool-bookings?${q}` : '/admin/pool-bookings';
}

export function parsePoolHubTab(value: string | null): PoolHubTab {
  return parseEventsHubTab(value);
}

/** @deprecated Prefer adminPoolHref — kept for clarity when reading shared code. */
export function poolAreasHref() {
  return adminPoolHref('areas');
}

export { adminEventsHref };
