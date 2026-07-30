export const ROOM_CATEGORIES = [
  'Standard',
  'Deluxe',
  'Suite',
  'Family',
  'Cottage',
  'Dorm',
  'Other',
] as const;

export type RoomCategory = (typeof ROOM_CATEGORIES)[number] | string;

/** Preset amenities for room admin chips (Iconify Solar set). */
export const ROOM_AMENITIES = [
  { label: 'Wi‑Fi', icon: 'solar:wi-fi-router-bold-duotone' },
  { label: 'Air conditioning', icon: 'solar:wind-bold-duotone' },
  { label: 'Ceiling fan', icon: 'solar:wind-bold-duotone' },
  { label: 'Private bathroom', icon: 'solar:bath-bold-duotone' },
  { label: 'Hot shower', icon: 'solar:waterdrops-bold-duotone' },
  { label: 'Towels', icon: 'solar:hanger-2-bold-duotone' },
  { label: 'Toiletries', icon: 'solar:bottle-bold-duotone' },
  { label: 'Queen bed', icon: 'solar:bed-bold-duotone' },
  { label: 'Twin beds', icon: 'solar:bedside-table-2-bold-duotone' },
  { label: 'Extra bed', icon: 'solar:bed-bold-duotone' },
  { label: 'Work desk', icon: 'solar:laptop-bold-duotone' },
  { label: 'Wardrobe', icon: 'solar:hanger-bold-duotone' },
  { label: 'Safe', icon: 'solar:lock-keyhole-minimalistic-bold-duotone' },
  { label: 'TV', icon: 'solar:tv-bold-duotone' },
  { label: 'Smart TV', icon: 'solar:monitor-smartphone-bold-duotone' },
  { label: 'Mini fridge', icon: 'solar:fridge-bold-duotone' },
  { label: 'Electric kettle', icon: 'solar:cup-hot-bold-duotone' },
  { label: 'Coffee / tea', icon: 'solar:cup-bold-duotone' },
  { label: 'Microwave', icon: 'solar:chef-hat-minimalistic-bold-duotone' },
  { label: 'Kitchenette', icon: 'solar:chef-hat-bold-duotone' },
  { label: 'Dining area', icon: 'solar:plate-bold-duotone' },
  { label: 'Balcony', icon: 'solar:home-2-bold-duotone' },
  { label: 'Ocean view', icon: 'solar:water-sun-bold-duotone' },
  { label: 'Garden view', icon: 'solar:leaf-bold-duotone' },
  { label: 'Mountain view', icon: 'solar:mountains-bold-duotone' },
  { label: 'Private entrance', icon: 'solar:key-minimalistic-bold-duotone' },
  { label: 'Parking', icon: 'solar:wheel-bold-duotone' },
  { label: 'Free parking', icon: 'solar:garage-bold-duotone' },
  { label: 'Pool access', icon: 'solar:swimming-bold-duotone' },
  { label: 'Beach access', icon: 'solar:sun-fog-bold-duotone' },
  { label: 'Breakfast included', icon: 'solar:cup-hot-bold-duotone' },
  { label: 'Room service', icon: 'solar:delivery-bold-duotone' },
  { label: 'Daily housekeeping', icon: 'solar:broom-bold-duotone' },
  { label: 'Laundry', icon: 'solar:washing-machine-bold-duotone' },
  { label: 'Hair dryer', icon: 'solar:mirror-bold-duotone' },
  { label: 'Iron / ironing board', icon: 'solar:t-shirt-bold-duotone' },
  { label: 'Mosquito net', icon: 'solar:shield-check-bold-duotone' },
  { label: 'Non-smoking', icon: 'solar:forbidden-circle-bold-duotone' },
  { label: 'Pet friendly', icon: 'solar:cat-bold-duotone' },
  { label: 'Wheelchair accessible', icon: 'solar:accessibility-bold-duotone' },
  { label: 'Family friendly', icon: 'solar:users-group-rounded-bold-duotone' },
  { label: 'Power outlet / USB', icon: 'solar:socket-bold-duotone' },
  { label: 'Blackout curtains', icon: 'solar:moon-sleep-bold-duotone' },
  { label: 'Soundproof', icon: 'solar:muted-bold-duotone' },
  { label: 'Fire extinguisher', icon: 'solar:fire-bold-duotone' },
  { label: 'First aid kit', icon: 'solar:medical-kit-bold-duotone' },
  { label: '24/7 reception', icon: 'solar:clock-circle-bold-duotone' },
] as const;

export function amenityIcon(label: string) {
  const found = ROOM_AMENITIES.find(
    (a) => a.label.toLowerCase() === label.trim().toLowerCase(),
  );
  return found?.icon ?? 'solar:check-circle-bold-duotone';
}

export type RoomAvailability = 'open' | 'unavailable';

export type Room = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  amenities: string[];
  price_per_night: number;
  currency: string;
  capacity: number;
  /** Cover / primary image (first of image_urls). */
  image_url: string | null;
  /** Full gallery for the room. */
  image_urls: string[];
  category: string;
  is_active: boolean;
  /** Manual block: open | unavailable (maintenance/closed). */
  availability: RoomAvailability;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RoomInsert = {
  name: string;
  slug: string;
  description?: string | null;
  amenities?: string[];
  price_per_night?: number;
  currency?: string;
  capacity?: number;
  image_url?: string | null;
  image_urls?: string[];
  category?: string;
  is_active?: boolean;
  availability?: RoomAvailability;
  sort_order?: number;
};

/** Normalize room gallery (supports legacy image_url-only rows). */
export function roomImages(room: {
  image_url?: string | null;
  image_urls?: string[] | null;
}): string[] {
  const urls = Array.isArray(room.image_urls)
    ? room.image_urls.filter((u): u is string => Boolean(u && String(u).trim()))
    : [];
  if (urls.length > 0) return urls;
  if (room.image_url) return [room.image_url];
  return [];
}

export function slugifyRoomName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
