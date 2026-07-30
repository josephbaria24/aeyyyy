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
  created_at: string;
  updated_at: string;
};

export const EVENT_LAYOUTS: { value: EventLayout; label: string; hint: string }[] = [
  { value: 'featured', label: 'Featured', hint: 'Large hero tile' },
  { value: 'wide', label: 'Wide', hint: 'Full-width banner' },
  { value: 'card', label: 'Card', hint: 'Standard grid card' },
];

export function slugifyEventTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
