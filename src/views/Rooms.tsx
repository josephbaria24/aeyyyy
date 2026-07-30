'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  CarouselSection,
  type CarouselCardItem,
} from '@/components/kokonutui/carousel-cards';
import { useActiveRooms } from '@/lib/admin/queries';
import { SYSTEM_CURRENCY_SYMBOL } from '@/lib/money';
import { roomImages, type Room } from '@/lib/types/room';
import { images } from '@/lib/images';

const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
};

function roomToCarouselItem(room: Room): CarouselCardItem {
  const photos = roomImages(room);
  const unavailable = room.availability === 'unavailable';
  return {
    id: room.id,
    title: room.name,
    image: photos[0] ?? '',
    location: `Up to ${room.capacity} guest${room.capacity === 1 ? '' : 's'}`,
    price: room.price_per_night,
    currency: SYSTEM_CURRENCY_SYMBOL,
    priceUnit: 'night',
    badge: room.category || 'Standard',
    statusBadge: unavailable ? 'Temporarily unavailable' : undefined,
    date: room.description?.trim() || undefined,
    href: `/book?room=${encodeURIComponent(room.name)}`,
    disabled: unavailable,
  };
}

export default function Rooms() {
  const { data: rooms = [], isPending, error } = useActiveRooms();
  const [category, setCategory] = useState('All');

  const categories = useMemo(() => {
    const set = new Set(rooms.map((r) => r.category || 'Standard'));
    return ['All', ...Array.from(set).sort()];
  }, [rooms]);

  const filtered = useMemo(() => {
    if (category === 'All') return rooms;
    return rooms.filter((r) => (r.category || 'Standard') === category);
  }, [rooms, category]);

  const carouselSections = useMemo(() => {
    if (category !== 'All') {
      return [
        {
          title: `${category} rooms`,
          items: filtered.map(roomToCarouselItem),
          viewAllHref: '/book',
        },
      ];
    }

    const byCategory = new Map<string, Room[]>();
    for (const room of rooms) {
      const cat = room.category || 'Standard';
      const list = byCategory.get(cat) ?? [];
      list.push(room);
      byCategory.set(cat, list);
    }

    return Array.from(byCategory.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, list]) => ({
        title: `${cat} rooms`,
        items: list.map(roomToCarouselItem),
        viewAllHref: '/book',
      }));
  }, [category, filtered, rooms]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <section className="relative flex min-h-[42vh] items-end overflow-hidden pb-12 pt-28 md:min-h-[48vh] md:pb-16">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images.heroBg}
            alt="Aeyyyy Traveller's Inn rooms"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628] via-[#0a1628]/55 to-black/25" />
        </div>

        <div className="container relative z-10 mx-auto px-6">
          <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="max-w-3xl text-white">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
              Stay with us
            </p>
            <h1 className="mb-4 text-5xl font-bold tracking-tight md:text-7xl">Rooms</h1>
            <p className="max-w-xl text-lg font-light text-white/85 md:text-xl">
              Quiet sanctuaries curated for rest after the day&apos;s wander — managed live by our
              inn team.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#f8fafc] py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="mb-10 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-[#0a1628] md:text-4xl">
                Our rooms
              </h2>
              <p className="mt-2 max-w-xl text-[#0a1628]/60">
                Browse by category. Rates shown are per night and update when the admin publishes
                changes.
              </p>
            </div>
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
            >
              Book a stay <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          {categories.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    category === cat
                      ? 'bg-[#0a1628] text-white'
                      : 'bg-white text-[#0a1628]/70 hover:bg-[#0a1628]/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error.message}
              {error.message.toLowerCase().includes('rooms') ||
              error.message.toLowerCase().includes('schema') ? (
                <span className="mt-1 block text-xs">
                  Tip: run <code>supabase/rooms-schema.sql</code> and{' '}
                  <code>supabase/content-schema.sql</code> in the Supabase SQL Editor.
                </span>
              ) : null}
            </div>
          )}

          {isPending && rooms.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-[#0a1628]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-[#0a1628]/10 bg-white px-6 py-16 text-center">
              <p className="text-lg font-semibold text-[#0a1628]">No rooms in this category</p>
              <p className="mt-2 text-sm text-[#0a1628]/55">
                Try another filter, or check back after the admin publishes rooms.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {carouselSections.map((section) => (
                <CarouselSection
                  key={section.title}
                  title={section.title}
                  items={section.items}
                  viewAllHref={section.viewAllHref}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
