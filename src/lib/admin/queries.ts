'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Booking } from '@/lib/types/booking';
import { normalizeBooking } from '@/lib/types/booking';
import type { Expense, Income } from '@/lib/types/accounting';
import type { Room } from '@/lib/types/room';
import { roomImages } from '@/lib/types/room';
import { mapSiteEvent, type SiteEvent, type SiteRule } from '@/lib/types/content';
import type { EventBooking } from '@/lib/types/event-booking';
import { normalizeEventBooking } from '@/lib/types/event-booking';
import type { EventOffering } from '@/lib/types/event-offering';
import { mapEventOffering } from '@/lib/types/event-offering';
import type { ActivityLog } from '@/lib/types/activity-log';
import {
  DEFAULT_GALLERY,
  DEFAULT_SITE_SETTINGS,
  mapSiteSettings,
  type SiteGalleryItem,
  type SitePartner,
  type SiteSettings,
} from '@/lib/types/site';

export const adminKeys = {
  all: ['admin'] as const,
  bookings: ['admin', 'bookings'] as const,
  income: ['admin', 'income'] as const,
  expenses: ['admin', 'expenses'] as const,
  rooms: ['admin', 'rooms'] as const,
  rules: ['admin', 'rules'] as const,
  events: ['admin', 'events'] as const,
  eventBookings: ['admin', 'event-bookings'] as const,
  offerings: ['admin', 'offerings'] as const,
  activity: ['admin', 'activity'] as const,
  site: ['admin', 'site'] as const,
  gallery: ['admin', 'gallery'] as const,
  partners: ['admin', 'partners'] as const,
  booking: (id: string) => ['admin', 'booking', id] as const,
};

function mapRoom(row: Room): Room {
  const image_urls = roomImages(row);
  return {
    ...row,
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    price_per_night: Number(row.price_per_night) || 0,
    capacity: Number(row.capacity) || 1,
    category: row.category || 'Standard',
    availability: row.availability === 'unavailable' ? 'unavailable' : 'open',
    image_urls,
    image_url: image_urls[0] ?? row.image_url ?? null,
  };
}

export async function fetchBookings() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as Booking[]) ?? []).map((row) => normalizeBooking(row));
}

export async function fetchIncome() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('income')
    .select('*')
    .order('income_date', { ascending: false });
  if (error) throw error;
  return (data as Income[]) ?? [];
}

export async function fetchExpenses() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return (data as Expense[]) ?? [];
}

export async function fetchRooms() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as Room[]) ?? []).map(mapRoom);
}

export async function fetchActiveRooms() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as Room[]) ?? []).map(mapRoom);
}

export async function fetchRules() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('site_rules')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as SiteRule[]) ?? [];
}

export async function fetchActiveRules() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('site_rules')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as SiteRule[]) ?? [];
}

export async function fetchEvents() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('event_date', { ascending: false });
  if (error) throw error;
  return ((data as SiteEvent[]) ?? []).map((row) => mapSiteEvent(row));
}

export async function fetchActiveEvents() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('event_date', { ascending: false });
  if (error) throw error;
  return ((data as SiteEvent[]) ?? []).map((row) => mapSiteEvent(row));
}

export async function fetchOfferings() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('event_offerings')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data as EventOffering[]) ?? []).map((row) => mapEventOffering(row));
  } catch {
    return [];
  }
}

export async function fetchActiveOfferings() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('event_offerings')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data as EventOffering[]) ?? []).map((row) => mapEventOffering(row));
  } catch {
    return [];
  }
}

export async function fetchEventBookings() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_bookings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as EventBooking[]) ?? []).map((row) => normalizeEventBooking(row));
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    if (error) throw error;
    return mapSiteSettings(data as Record<string, unknown> | null);
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function fetchGallery(activeOnly = false): Promise<SiteGalleryItem[]> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('site_gallery')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data as SiteGalleryItem[]) ?? [];
  } catch {
    return activeOnly ? DEFAULT_GALLERY : [];
  }
}

export async function fetchPartners(activeOnly = false): Promise<SitePartner[]> {
  try {
    const supabase = createClient();
    let query = supabase
      .from('site_partners')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data as SitePartner[]) ?? [];
  } catch {
    return [];
  }
}

export async function fetchActivityLogs() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) throw error;
  return (data as ActivityLog[]) ?? [];
}

export async function fetchBooking(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
  if (error) throw error;
  return normalizeBooking(data as Booking);
}

const adminCacheOptions = {
  /** Cached until mutation or realtime invalidation. */
  staleTime: Infinity,
  gcTime: 60 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

const publicCacheOptions = {
  staleTime: 2 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnMount: true,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;

export function useBookings(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: adminKeys.bookings,
    queryFn: fetchBookings,
    ...adminCacheOptions,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useIncome() {
  return useQuery({
    queryKey: adminKeys.income,
    queryFn: fetchIncome,
    ...adminCacheOptions,
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: adminKeys.expenses,
    queryFn: fetchExpenses,
    ...adminCacheOptions,
  });
}

export function useRooms() {
  return useQuery({
    queryKey: adminKeys.rooms,
    queryFn: fetchRooms,
    ...adminCacheOptions,
  });
}

export function useActiveRooms() {
  return useQuery({
    queryKey: [...adminKeys.rooms, 'active'] as const,
    queryFn: fetchActiveRooms,
    ...publicCacheOptions,
  });
}

export type OccupancyStayRow = {
  destination: string;
  check_in: string;
  check_out: string;
};

async function fetchOccupancyStays(): Promise<OccupancyStayRow[]> {
  const res = await fetch('/api/room-availability');
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Could not load room availability');
  }
  const json = (await res.json()) as { stays?: OccupancyStayRow[] };
  return json.stays ?? [];
}

/** Confirmed stay windows for public booking availability checks. */
export function useOccupancyStays() {
  return useQuery({
    queryKey: ['public', 'room-occupancy'] as const,
    queryFn: fetchOccupancyStays,
    ...publicCacheOptions,
    refetchInterval: 60_000,
  });
}

export type EventOccupancyStay = OccupancyStayRow & { offeringId: string };

export type EventOccupancyPayload = {
  stays: EventOccupancyStay[];
  unavailable: string[];
};

async function fetchEventOccupancyStays(): Promise<EventOccupancyPayload> {
  try {
    const res = await fetch('/api/event-availability');
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || 'Could not load event availability');
    }
    const json = (await res.json()) as {
      stays?: EventOccupancyStay[];
      unavailable?: string[];
    };
    return {
      stays: json.stays ?? [],
      unavailable: json.unavailable ?? [],
    };
  } catch {
    return { stays: [], unavailable: [] };
  }
}

/** Holding stay windows for public event-area booking. */
export function useEventOccupancyStays() {
  return useQuery({
    queryKey: ['public', 'event-occupancy'] as const,
    queryFn: fetchEventOccupancyStays,
    ...publicCacheOptions,
    refetchInterval: 60_000,
  });
}

export function useRules() {
  return useQuery({
    queryKey: adminKeys.rules,
    queryFn: fetchRules,
    ...adminCacheOptions,
  });
}

export function useActiveRules() {
  return useQuery({
    queryKey: [...adminKeys.rules, 'active'] as const,
    queryFn: fetchActiveRules,
    ...publicCacheOptions,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: adminKeys.events,
    queryFn: fetchEvents,
    ...adminCacheOptions,
  });
}

export function useActiveEvents() {
  return useQuery({
    queryKey: [...adminKeys.events, 'active'] as const,
    queryFn: fetchActiveEvents,
    ...publicCacheOptions,
  });
}

export function useEventBookings() {
  return useQuery({
    queryKey: adminKeys.eventBookings,
    queryFn: fetchEventBookings,
    ...adminCacheOptions,
  });
}

export function useOfferings() {
  return useQuery({
    queryKey: adminKeys.offerings,
    queryFn: fetchOfferings,
    ...adminCacheOptions,
  });
}

export function useActiveOfferings() {
  return useQuery({
    queryKey: [...adminKeys.offerings, 'active'] as const,
    queryFn: fetchActiveOfferings,
    ...publicCacheOptions,
  });
}

export function useSiteSettings() {
  return useQuery({
    queryKey: adminKeys.site,
    queryFn: fetchSiteSettings,
    ...adminCacheOptions,
  });
}

export function usePublicSiteSettings() {
  return useQuery({
    queryKey: [...adminKeys.site, 'public'] as const,
    queryFn: fetchSiteSettings,
    ...publicCacheOptions,
  });
}

export function useGallery() {
  return useQuery({
    queryKey: adminKeys.gallery,
    queryFn: () => fetchGallery(false),
    ...adminCacheOptions,
  });
}

export function useActiveGallery() {
  return useQuery({
    queryKey: [...adminKeys.gallery, 'active'] as const,
    queryFn: () => fetchGallery(true),
    ...publicCacheOptions,
  });
}

export function usePartners() {
  return useQuery({
    queryKey: adminKeys.partners,
    queryFn: () => fetchPartners(false),
    ...adminCacheOptions,
  });
}

export function useActivePartners() {
  return useQuery({
    queryKey: [...adminKeys.partners, 'active'] as const,
    queryFn: () => fetchPartners(true),
    ...publicCacheOptions,
  });
}

export function useActivityLogs() {
  return useQuery({
    queryKey: adminKeys.activity,
    queryFn: fetchActivityLogs,
    ...adminCacheOptions,
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: adminKeys.booking(id),
    queryFn: () => fetchBooking(id),
    enabled: Boolean(id),
    ...adminCacheOptions,
  });
}

export type AdminInvalidateKey =
  | 'bookings'
  | 'income'
  | 'expenses'
  | 'rooms'
  | 'rules'
  | 'events'
  | 'eventBookings'
  | 'offerings'
  | 'activity'
  | 'site'
  | 'gallery'
  | 'partners';

export function invalidateAdminData(
  queryClient: QueryClient,
  keys: AdminInvalidateKey[] = [
    'bookings',
    'income',
    'expenses',
    'rooms',
    'rules',
    'events',
    'eventBookings',
    'offerings',
    'activity',
    'site',
    'gallery',
    'partners',
  ],
) {
  return Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: adminKeys[key] })));
}

export function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return (keys?: AdminInvalidateKey[]) => invalidateAdminData(queryClient, keys);
}

export function prefetchAdminRoute(queryClient: QueryClient, href: string) {
  if (href === '/admin' || href === '/admin/reports') {
    void queryClient.prefetchQuery({
      queryKey: adminKeys.bookings,
      queryFn: fetchBookings,
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.income,
      queryFn: fetchIncome,
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.expenses,
      queryFn: fetchExpenses,
      ...adminCacheOptions,
    });
    return;
  }
  if (href === '/admin/accounting') {
    void queryClient.prefetchQuery({
      queryKey: adminKeys.income,
      queryFn: fetchIncome,
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.expenses,
      queryFn: fetchExpenses,
      ...adminCacheOptions,
    });
    return;
  }
  if (
    href === '/admin/rooms' ||
    href.startsWith('/admin/rooms?') ||
    href === '/admin/bookings' ||
    href === '/admin/guests'
  ) {
    void queryClient.prefetchQuery({
      queryKey: adminKeys.rooms,
      queryFn: fetchRooms,
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.bookings,
      queryFn: fetchBookings,
      ...adminCacheOptions,
    });
    return;
  }
  if (href === '/admin/content') {
    void queryClient.prefetchQuery({
      queryKey: adminKeys.rules,
      queryFn: fetchRules,
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.events,
      queryFn: fetchEvents,
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.site,
      queryFn: fetchSiteSettings,
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.gallery,
      queryFn: () => fetchGallery(false),
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.partners,
      queryFn: () => fetchPartners(false),
      ...adminCacheOptions,
    });
    return;
  }
  if (href === '/admin/event-bookings' || href.startsWith('/admin/event-bookings?')) {
    void queryClient.prefetchQuery({
      queryKey: adminKeys.eventBookings,
      queryFn: fetchEventBookings,
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.offerings,
      queryFn: fetchOfferings,
      ...adminCacheOptions,
    });
    void queryClient.prefetchQuery({
      queryKey: adminKeys.events,
      queryFn: fetchEvents,
      ...adminCacheOptions,
    });
    return;
  }
  if (href === '/admin/activity') {
    void queryClient.prefetchQuery({
      queryKey: adminKeys.activity,
      queryFn: fetchActivityLogs,
      ...adminCacheOptions,
    });
  }
}
