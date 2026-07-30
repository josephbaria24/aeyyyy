'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Booking } from '@/lib/types/booking';
import { normalizeBooking } from '@/lib/types/booking';
import type { Expense, Income } from '@/lib/types/accounting';
import type { Room } from '@/lib/types/room';
import { roomImages } from '@/lib/types/room';
import type { SiteEvent, SiteRule } from '@/lib/types/content';

export const adminKeys = {
  all: ['admin'] as const,
  bookings: ['admin', 'bookings'] as const,
  income: ['admin', 'income'] as const,
  expenses: ['admin', 'expenses'] as const,
  rooms: ['admin', 'rooms'] as const,
  rules: ['admin', 'rules'] as const,
  events: ['admin', 'events'] as const,
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
  return (data as SiteEvent[]) ?? [];
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
  return (data as SiteEvent[]) ?? [];
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
  | 'events';

export function invalidateAdminData(
  queryClient: QueryClient,
  keys: AdminInvalidateKey[] = ['bookings', 'income', 'expenses', 'rooms', 'rules', 'events'],
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
  }
}
