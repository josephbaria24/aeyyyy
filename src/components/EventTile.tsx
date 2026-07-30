'use client';

import { motion } from 'framer-motion';
import { EventShareButtons } from '@/components/EventShareButtons';
import type { EventLayout, SiteEvent } from '@/lib/types/content';
import { cn } from '@/lib/utils';

export function formatEventDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function eventLayoutHeight(layout: EventLayout) {
  if (layout === 'featured') return 'min-h-[420px] md:min-h-[480px]';
  if (layout === 'wide') return 'min-h-[260px] md:min-h-[300px]';
  return 'min-h-[360px]';
}

type EventTileProps = {
  event: SiteEvent;
  className?: string;
  /** Disable framer motion (admin preview). */
  animated?: boolean;
  /** Hide share buttons in compact previews. */
  hideShare?: boolean;
};

export function EventTile({
  event,
  className,
  animated = true,
  hideShare = false,
}: EventTileProps) {
  const dateLabel = formatEventDate(event.event_date);

  const body = (
    <>
      {event.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.image_url}
          alt={event.title || 'Event'}
          className="absolute inset-0 h-full w-full rounded-[10px] object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 rounded-[10px] bg-gradient-to-br from-[#0a1628] to-[#1a3a4a]" />
      )}
      <div className="relative z-10 flex h-full min-h-[inherit] flex-col justify-end p-6 md:p-8">
        {/* Text sits on a local scrim only — no full-image fade */}
        <div className="max-w-2xl rounded-[10px] bg-black/45 px-4 py-3 backdrop-blur-[2px] md:px-5 md:py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            {dateLabel && <span>{dateLabel}</span>}
            {dateLabel && event.location && <span aria-hidden>·</span>}
            {event.location && (
              <span className="normal-case tracking-normal text-white/80">{event.location}</span>
            )}
          </div>
          {event.subtitle && (
            <p className="mb-1 text-sm font-medium text-white/85">{event.subtitle}</p>
          )}
          <h3 className="mb-3 text-2xl font-bold text-white md:text-3xl">
            {event.title || 'Event title'}
          </h3>
          {event.description && (
            <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-white/85">
              {event.description}
            </p>
          )}
          {!hideShare && event.slug ? <EventShareButtons event={event} /> : null}
        </div>
      </div>
    </>
  );

  const shellClass = cn(
    'relative overflow-hidden rounded-[10px] group',
    className,
  );

  if (!animated) {
    return (
      <article id={event.slug ? `event-${event.slug}` : undefined} className={shellClass}>
        {body}
      </article>
    );
  }

  return (
    <motion.article
      id={event.slug ? `event-${event.slug}` : undefined}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={shellClass}
    >
      {body}
    </motion.article>
  );
}
