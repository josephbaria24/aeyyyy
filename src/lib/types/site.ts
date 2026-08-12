import { images } from '@/lib/images';

export type SiteSettings = {
  id: string;
  hero_image_url: string;
  hero_title: string;
  hero_italic: string;
  hero_subtitle: string;
  hero_address: string;
  hero_phone: string;
  gallery_kicker: string;
  gallery_title: string;
  gallery_body: string;
  difference_title: string;
  difference_body: string;
  difference_image_1: string;
  difference_image_2: string;
  difference_point_1_title: string;
  difference_point_1_body: string;
  difference_point_2_title: string;
  difference_point_2_body: string;
  difference_point_3_title: string;
  difference_point_3_body: string;
  partners_title: string;
  partners_subtitle: string;
  footer_blurb: string;
  footer_phone: string;
  footer_email: string;
  footer_address: string;
  footer_instagram: string;
  footer_facebook: string;
  footer_twitter: string;
  footer_linkedin: string;
  footer_privacy_url: string;
  footer_terms_url: string;
  footer_cancellation_url: string;
};

export type SiteGalleryItem = {
  id: string;
  image_url: string;
  title: string;
  subtitle: string | null;
  sort_order: number;
  is_active: boolean;
};

export type SitePartner = {
  id: string;
  name: string;
  image_url: string | null;
  url: string | null;
  sort_order: number;
  is_active: boolean;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: 'default',
  hero_image_url: images.heroBg,
  hero_title: 'Relax, Stay & Swim',
  hero_italic: "at Aeyyyy Traveller's Inn",
  hero_subtitle:
    'Comfortable rooms, refreshing poolside moments, and warm hospitality for a stay that feels like home.',
  hero_address: 'Macawili Road, Bancao-Bancao, Puerto Princesa City',
  hero_phone: '0945-413-9360',
  gallery_kicker: "By Aeyyyy Traveller's Inn",
  gallery_title: 'Hotel & Poolside Comfort',
  gallery_body:
    'Settle into a comfortable room, take a refreshing swim, and enjoy an easygoing stay with the people who matter most.',
  difference_title: "The difference is Aeyyyy Traveller's Inn",
  difference_body:
    'We make every stay simple, comfortable, and welcoming. From restful rooms to relaxing afternoons by the pool, our team is here to help you feel at home.',
  difference_image_1: images.diff1,
  difference_image_2: images.diff2,
  difference_point_1_title: 'Warm Hospitality',
  difference_point_1_body: 'Friendly, attentive service that makes every guest feel welcome.',
  difference_point_2_title: 'Poolside Relaxation',
  difference_point_2_body: 'A refreshing outdoor pool for swimming, lounging, and family time.',
  difference_point_3_title: 'Everyday Comfort',
  difference_point_3_body: 'Clean rooms, useful amenities, and peaceful spaces for a restful stay.',
  partners_title: 'Our Partners',
  partners_subtitle: 'Collaborating with leading brands to create exceptional experiences',
  footer_blurb:
    'Comfortable rooms, a refreshing outdoor pool, and warm hospitality for families, friends, and travelers.',
  footer_phone: '0945-413-9360',
  footer_email: 'reservations@aeyyyytravellersinn.com',
  footer_address: 'Macawili Road, Bancao-Bancao, Puerto Princesa City',
  footer_instagram: '',
  footer_facebook: '',
  footer_twitter: '',
  footer_linkedin: '',
  footer_privacy_url: '/',
  footer_terms_url: '/',
  footer_cancellation_url: '/',
};

export const DEFAULT_GALLERY: SiteGalleryItem[] = [
  { id: 'd1', image_url: '/images/gate.png', title: 'A Warm Welcome', subtitle: 'Hotel Entrance', sort_order: 0, is_active: true },
  { id: 'd2', image_url: '/images/kitchen.png', title: 'Guest Kitchen', subtitle: 'Convenient Amenities', sort_order: 1, is_active: true },
  { id: 'd3', image_url: '/images/hero2.webp', title: 'Poolside Relaxation', subtitle: 'Rest & Recharge', sort_order: 2, is_active: true },
  { id: 'd4', image_url: '/images/hallway.png', title: 'Clean Hotel Hallways', subtitle: 'Bright & Welcoming', sort_order: 3, is_active: true },
  { id: 'd5', image_url: '/images/beds.png', title: 'Comfortable Rooms', subtitle: 'Rest Easy', sort_order: 4, is_active: true },
  { id: 'd6', image_url: '/images/band area.png', title: 'Music & Entertainment', subtitle: 'Band Area', sort_order: 5, is_active: true },
  { id: 'd7', image_url: '/images/reception.png', title: 'Relaxing Common Areas', subtitle: 'Guest Lounge', sort_order: 6, is_active: true },
];

function str(row: Record<string, unknown>, key: string, fallback: string) {
  const value = row[key];
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

export function mapSiteSettings(row: Record<string, unknown> | null | undefined): SiteSettings {
  const d = DEFAULT_SITE_SETTINGS;
  if (!row) return d;
  return {
    id: String(row.id ?? 'default'),
    hero_image_url: str(row, 'hero_image_url', d.hero_image_url),
    hero_title: str(row, 'hero_title', d.hero_title),
    hero_italic: str(row, 'hero_italic', d.hero_italic),
    hero_subtitle: str(row, 'hero_subtitle', d.hero_subtitle),
    hero_address: str(row, 'hero_address', d.hero_address),
    hero_phone: str(row, 'hero_phone', d.hero_phone),
    gallery_kicker: str(row, 'gallery_kicker', d.gallery_kicker),
    gallery_title: str(row, 'gallery_title', d.gallery_title),
    gallery_body: str(row, 'gallery_body', d.gallery_body),
    difference_title: str(row, 'difference_title', d.difference_title),
    difference_body: str(row, 'difference_body', d.difference_body),
    difference_image_1: str(row, 'difference_image_1', d.difference_image_1),
    difference_image_2: str(row, 'difference_image_2', d.difference_image_2),
    difference_point_1_title: str(row, 'difference_point_1_title', d.difference_point_1_title),
    difference_point_1_body: str(row, 'difference_point_1_body', d.difference_point_1_body),
    difference_point_2_title: str(row, 'difference_point_2_title', d.difference_point_2_title),
    difference_point_2_body: str(row, 'difference_point_2_body', d.difference_point_2_body),
    difference_point_3_title: str(row, 'difference_point_3_title', d.difference_point_3_title),
    difference_point_3_body: str(row, 'difference_point_3_body', d.difference_point_3_body),
    partners_title: str(row, 'partners_title', d.partners_title),
    partners_subtitle: str(row, 'partners_subtitle', d.partners_subtitle),
    footer_blurb: str(row, 'footer_blurb', d.footer_blurb),
    footer_phone: str(row, 'footer_phone', d.footer_phone),
    footer_email: str(row, 'footer_email', d.footer_email),
    footer_address: str(row, 'footer_address', d.footer_address),
    footer_instagram: typeof row.footer_instagram === 'string' ? row.footer_instagram : '',
    footer_facebook: typeof row.footer_facebook === 'string' ? row.footer_facebook : '',
    footer_twitter: typeof row.footer_twitter === 'string' ? row.footer_twitter : '',
    footer_linkedin: typeof row.footer_linkedin === 'string' ? row.footer_linkedin : '',
    footer_privacy_url: str(row, 'footer_privacy_url', d.footer_privacy_url),
    footer_terms_url: str(row, 'footer_terms_url', d.footer_terms_url),
    footer_cancellation_url: str(row, 'footer_cancellation_url', d.footer_cancellation_url),
  };
}

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
