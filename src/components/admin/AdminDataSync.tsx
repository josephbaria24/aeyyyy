'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { adminKeys } from '@/lib/admin/queries';

/**
 * Keeps admin React Query cache fresh via Supabase Realtime.
 * Pages reuse cached data until a real DB change arrives (or a local mutation invalidates).
 */
export function AdminDataSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-data-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.bookings });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.rooms });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'income' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.income });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.expenses });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_rules' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.rules });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.events });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_bookings' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.eventBookings });
          void queryClient.invalidateQueries({ queryKey: ['public', 'event-occupancy'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_offerings' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.offerings });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_logs' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.activity });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.site });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_gallery' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.gallery });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_partners' },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.partners });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
