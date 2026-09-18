export type OfferingCategory = 'event' | 'pool';

export type EventOffering = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  notes: string | null;
  price: number;
  capacity: number;
  sort_order: number;
  is_active: boolean;
  availability: 'open' | 'unavailable';
  category: OfferingCategory;
  image_urls: string[];
  created_at: string;
};

export function isOfferingCategory(value: string): value is OfferingCategory {
  return value === 'event' || value === 'pool';
}

export function filterOfferingsByCategory(
  offerings: EventOffering[],
  category: OfferingCategory,
) {
  return offerings.filter((item) => item.category === category);
}

export function eventAreaImages(row: { image_urls?: string[] | null }) {
  return Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [];
}

export function mapEventOffering(
  row: Partial<EventOffering> & Record<string, unknown>,
): EventOffering {
  const image_urls = eventAreaImages(row);
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    description: (row.description as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    price: Number(row.price) || 0,
    capacity: Math.max(0, Number(row.capacity) || 0),
    sort_order: Number(row.sort_order) || 0,
    is_active: Boolean(row.is_active),
    availability: row.availability === 'unavailable' ? 'unavailable' : 'open',
    category: row.category === 'pool' ? 'pool' : 'event',
    image_urls,
    created_at: String(row.created_at ?? ''),
  };
}
