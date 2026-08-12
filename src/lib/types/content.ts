export type SiteRule = {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EventLayout = 'featured' | 'card' | 'wide';
export type EventListing = 'upcoming' | 'recent' | 'past';

export type SiteEvent = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  event_date: string | null;
  location: string | null;
  layout: EventLayout;
  sort_order: number;
  is_active: boolean;
  is_bookable: boolean;
  price: number;
  capacity: number;
  start_time: string | null;
  end_time: string | null;
  listing: EventListing;
  created_at: string;
  updated_at: string;
};

export function mapSiteEvent(row: Partial<SiteEvent> & Record<string, unknown>): SiteEvent {
  const layoutRaw = String(row.layout ?? 'card');
  const layout: EventLayout =
    layoutRaw === 'featured' || layoutRaw === 'wide' || layoutRaw === 'card'
      ? layoutRaw
      : 'card';
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    subtitle: (row.subtitle as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
    event_date: (row.event_date as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    layout,
    sort_order: Number(row.sort_order) || 0,
    is_active: Boolean(row.is_active),
    is_bookable: Boolean(row.is_bookable),
    price: Number(row.price) || 0,
    capacity: Math.max(0, Number(row.capacity) || 0),
    start_time: normalizeTime(row.start_time),
    end_time: normalizeTime(row.end_time),
    listing: normalizeListing(row.listing, row.event_date as string | null),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function normalizeListing(value: unknown, eventDate: string | null): EventListing {
  if (value === 'upcoming' || value === 'recent' || value === 'past') return value;
  if (!eventDate) return 'upcoming';
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return eventDate >= todayIso ? 'upcoming' : 'past';
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.slice(0, 5);
}

export function formatEventTimeRange(start: string | null, end: string | null) {
  if (!start && !end) return null;
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

export const EVENT_LAYOUTS: { value: EventLayout; label: string; hint: string }[] = [
  { value: 'featured', label: 'Featured', hint: 'Large hero tile' },
  { value: 'wide', label: 'Wide', hint: 'Full-width banner' },
  { value: 'card', label: 'Card', hint: 'Standard grid card' },
];

export const EVENT_LISTINGS: { value: EventListing; label: string; hint: string }[] = [
  { value: 'upcoming', label: 'Upcoming', hint: 'Shown first on the landing page' },
  { value: 'recent', label: 'Recent', hint: 'Just happened — still featured' },
  { value: 'past', label: 'Past', hint: 'Archive of earlier events' },
];

export function slugifyEventTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
