'use client';

import {
  EVENT_LAYOUTS,
  slugifyEventTitle,
  type EventLayout,
  type EventListing,
  type SiteEvent,
} from '@/lib/types/content';
import { EventTile, eventLayoutHeight } from '@/components/EventTile';
import { cn } from '@/lib/utils';

type PreviewForm = {
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  event_date: string;
  location: string;
  layout: EventLayout;
  sort_order: string;
  is_active: boolean;
  is_bookable?: boolean;
  price?: string;
  capacity?: string;
  start_time?: string;
  end_time?: string;
  listing?: EventListing;
};

function toPreviewEvent(form: PreviewForm): SiteEvent {
  const title = form.title.trim() || 'Your event title';
  return {
    id: 'preview',
    title,
    slug: slugifyEventTitle(title) || 'preview-event',
    subtitle: form.subtitle.trim() || null,
    description: form.description.trim() || null,
    image_url: form.image_url || null,
    event_date: form.event_date || null,
    location: form.location.trim() || null,
    layout: form.layout,
    sort_order: Number(form.sort_order) || 0,
    is_active: form.is_active,
    is_bookable: Boolean(form.is_bookable),
    price: Number(form.price) || 0,
    capacity: Math.max(0, Number(form.capacity) || 0),
    start_time: form.start_time?.trim() || null,
    end_time: form.end_time?.trim() || null,
    listing: form.listing ?? 'upcoming',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function EventLandingPreview({ form }: { form: PreviewForm }) {
  const event = toPreviewEvent(form);
  const layoutMeta = EVENT_LAYOUTS.find((l) => l.value === form.layout);

  return (
    <div className="rounded-[13px] admin-hairline overflow-hidden bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Landing page preview
          </p>
          <p className="text-xs text-slate-500">
            How this event appears in the Upcoming Events section
            {layoutMeta ? ` · ${layoutMeta.label}` : ''}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold',
            form.is_active
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800',
          )}
        >
          {form.is_active ? 'Visible' : 'Hidden'}
        </span>
      </div>

      {/* Position map */}
      <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Position on page
        </p>
        <div className="space-y-1.5 rounded-[9px] bg-slate-50 p-3 dark:bg-slate-950">
          <div
            className={cn(
              'rounded-[5px] px-3 py-2 text-xs font-semibold transition',
              form.layout === 'featured'
                ? 'bg-[#0a1628] text-white ring-2 ring-accent'
                : 'bg-white text-slate-400 admin-hairline dark:bg-slate-900',
            )}
          >
            Featured — large hero tile
            {form.layout === 'featured' && (
              <span className="ml-2 text-[10px] font-medium text-accent">← this event</span>
            )}
          </div>
          <div
            className={cn(
              'rounded-[5px] px-3 py-1.5 text-xs font-semibold transition',
              form.layout === 'wide'
                ? 'bg-[#0a1628] text-white ring-2 ring-accent'
                : 'bg-white text-slate-400 admin-hairline dark:bg-slate-900',
            )}
          >
            Wide — full-width banner
            {form.layout === 'wide' && (
              <span className="ml-2 text-[10px] font-medium text-accent">← this event</span>
            )}
          </div>
          <div
            className={cn(
              'grid grid-cols-3 gap-1.5 rounded-[5px] p-1.5 transition',
              form.layout === 'card' ? 'ring-2 ring-accent' : '',
            )}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'rounded-[4px] px-2 py-3 text-center text-[10px] font-semibold',
                  form.layout === 'card' && i === 0
                    ? 'bg-[#0a1628] text-white'
                    : 'bg-white text-slate-400 admin-hairline dark:bg-slate-900',
                )}
              >
                {form.layout === 'card' && i === 0 ? 'Card ★' : 'Card'}
              </div>
            ))}
          </div>
          {form.layout === 'card' && (
            <p className="pt-1 text-[11px] text-slate-500">
              Cards sit in a 3-column grid on desktop (1 on mobile).
            </p>
          )}
        </div>
      </div>

      {/* Actual landing-style preview */}
      <div className="bg-gradient-to-br from-[#0a1628] to-[#004e5e] p-4 md:p-6">
        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Upcoming Events
        </p>

        {form.layout === 'card' ? (
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
            <EventTile
              event={event}
              animated={false}
              hideShare
              className={cn(eventLayoutHeight('card'), 'md:col-span-1')}
            />
            <div className="hidden min-h-[360px] items-center justify-center rounded-[10px] border border-dashed border-white/20 text-xs text-white/35 md:flex">
              Other card
            </div>
            <div className="hidden min-h-[360px] items-center justify-center rounded-[10px] border border-dashed border-white/20 text-xs text-white/35 md:flex">
              Other card
            </div>
          </div>
        ) : form.layout === 'wide' ? (
          <div className="mx-auto max-w-5xl space-y-3">
            <div className="flex h-10 items-center justify-center rounded-[10px] border border-dashed border-white/15 text-[11px] text-white/30">
              Featured events above
            </div>
            <EventTile event={event} animated={false} hideShare className={eventLayoutHeight('wide')} />
            <div className="flex h-10 items-center justify-center rounded-[10px] border border-dashed border-white/15 text-[11px] text-white/30">
              Card grid below
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-3">
            <EventTile
              event={event}
              animated={false}
              hideShare
              className={eventLayoutHeight('featured')}
            />
            <div className="flex h-10 items-center justify-center rounded-[10px] border border-dashed border-white/15 text-[11px] text-white/30">
              Wide / card events below
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
