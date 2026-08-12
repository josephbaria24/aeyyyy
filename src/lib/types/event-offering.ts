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
  image_urls: string[];
  created_at: string;
};

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
    image_urls,
    created_at: String(row.created_at ?? ''),
  };
}
