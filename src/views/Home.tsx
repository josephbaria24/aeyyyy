'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { EventTile, eventLayoutHeight } from '@/components/EventTile';
import { BookingStatusChecker } from '@/components/BookingStatusChecker';
import { useActiveEvents, useActiveRules } from '@/lib/admin/queries';
import { 
  Waves, BedDouble, UsersRound, ConciergeBell, ArrowRight, ChevronLeft, ChevronRight,
  MapPin, Phone, CheckCircle2, ScrollText, X
} from 'lucide-react';
import { images } from '@/lib/images';

const heroBg = images.heroBg;
const entranceImg = '/images/gate.png';
const kitchenImg = '/images/kitchen.png';
const poolHeroImg = '/images/hero2.webp';
const hallwayImg = '/images/hallway.png';
const diff1Img = images.diff1;
const diff2Img = images.diff2;

const hotelGallery = [
  { img: entranceImg, title: 'A Warm Welcome', sub: 'Hotel Entrance' },
  { img: kitchenImg, title: 'Guest Kitchen', sub: 'Convenient Amenities' },
  { img: poolHeroImg, title: 'Poolside Relaxation', sub: 'Rest & Recharge' },
  { img: hallwayImg, title: 'Clean Hotel Hallways', sub: 'Bright & Welcoming' },
  { img: '/images/beds.png', title: 'Comfortable Rooms', sub: 'Rest Easy' },
  { img: '/images/band area.png', title: 'Music & Entertainment', sub: 'Band Area' },
  { img: '/images/reception.png', title: 'Relaxing Common Areas', sub: 'Guest Lounge' },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

export default function Home() {
  const { data: rules = [] } = useActiveRules();
  const { data: events = [] } = useActiveEvents();
  const [galleryRef, galleryApi] = useEmblaCarousel({
    align: 'start',
    loop: true,
  });
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [lightboxRef, lightboxApi] = useEmblaCarousel({ loop: true });

  useEffect(() => {
    if (!galleryApi || fullscreenIndex !== null) return;
    const timer = window.setInterval(() => galleryApi.scrollNext(), 4000);
    return () => window.clearInterval(timer);
  }, [fullscreenIndex, galleryApi]);

  useEffect(() => {
    if (fullscreenIndex === null || !lightboxApi) return;

    const syncIndex = () => setFullscreenIndex(lightboxApi.selectedScrollSnap());
    lightboxApi.on('select', syncIndex);
    lightboxApi.scrollTo(fullscreenIndex, true);
    return () => {
      lightboxApi.off('select', syncIndex);
    };
  }, [fullscreenIndex, lightboxApi]);

  useEffect(() => {
    if (fullscreenIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreenIndex(null);
      if (event.key === 'ArrowLeft') lightboxApi?.scrollPrev();
      if (event.key === 'ArrowRight') lightboxApi?.scrollNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [fullscreenIndex, lightboxApi]);

  const featured = useMemo(
    () => events.filter((e) => e.layout === 'featured'),
    [events],
  );
  const wide = useMemo(
    () => events.filter((e) => e.layout === 'wide'),
    [events],
  );
  const cards = useMemo(
    () => events.filter((e) => e.layout === 'card' || !e.layout),
    [events],
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <Navbar />

      {/* 1. Hero Section */}
      <section className="relative h-screen min-h-[800px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src={heroBg}
            alt="Aeyyyy Traveller's Inn swimming pool"
            fill
            priority
            unoptimized
            fetchPriority="high"
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10 pt-20">
          <motion.div 
            initial="hidden" animate="visible" variants={fadeInUp}
            className="max-w-4xl text-white mb-12"
          >
            <h1 className="text-6xl md:text-8xl font-bold mb-4 tracking-tight">
              Relax, Stay &amp; Swim <br/>
              <span className="font-light italic">at Aeyyyy Traveller&apos;s Inn</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl font-light">
              Comfortable rooms, refreshing poolside moments, and warm hospitality for a stay that feels like home.
            </p>
          </motion.div>

          {/* Glass Search Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
            className="glass p-2 rounded-full inline-flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-2 backdrop-blur-xl w-full max-w-4xl"
          >
            <div className="flex-1 flex items-center px-6 py-4 border-b md:border-b-0 md:border-r border-white/20 w-full text-white">
              <MapPin className="w-5 h-5 mr-3 text-white" />
              <div className="flex min-w-0 flex-col">
                <span className="text-xs uppercase tracking-wider text-white/60">Find us at</span>
                <span className="font-medium leading-snug">
                  Macawili Road, Bancao-Bancao, Puerto Princesa City
                </span>
              </div>
            </div>
            <div className="flex-1 flex items-center px-6 py-4 w-full text-white">
              <Phone className="w-5 h-5 mr-3 text-white" />
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-white/60">Call us</span>
                <a href="tel:09454139360" className="font-medium hover:text-accent">
                  0945-413-9360
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Our Features */}
      <section className="bg-white py-14 md:py-24">
        <div className="container mx-auto px-6">
          <div className="mx-auto mb-8 max-w-3xl text-center md:mb-16">
            <h2 className="mb-3 text-3xl font-bold text-[#0a1628] md:mb-6 md:text-5xl">Our Features</h2>
            <p className="text-sm text-gray-600 md:text-lg">
              Everything you need for a relaxing hotel stay, from comfortable rooms to refreshing time by the pool.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:gap-6 lg:grid-cols-4 lg:gap-8">
            {[
              { icon: Waves, title: "Refreshing Pool", desc: "Cool down, swim, or simply unwind beside our inviting outdoor pool surrounded by greenery." },
              { icon: BedDouble, title: "Comfortable Rooms", desc: "Clean, cozy rooms with practical amenities designed to help every guest rest comfortably." },
              { icon: UsersRound, title: "Guest-Friendly Spaces", desc: "Welcoming shared areas for families, friends, and travelers to relax and enjoy their stay." },
              { icon: ConciergeBell, title: "Comfort & Care", desc: "Attentive service and a safe, peaceful atmosphere from check-in through check-out." }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
                variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { delay: idx * 0.1, duration: 0.6 } } }}
                className="rounded-2xl bg-gray-50 p-4 shadow-sm transition-transform duration-300 hover:-translate-y-2 hover:shadow-xl md:rounded-3xl md:p-8"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-accent shadow-sm md:mb-6 md:h-14 md:w-14">
                  <feature.icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <h3 className="mb-2 text-base font-bold text-[#0a1628] md:mb-4 md:text-xl">{feature.title}</h3>
                <p className="text-xs leading-relaxed text-gray-600 md:text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Authentic Experiences */}
      <section className="relative overflow-hidden bg-[#0a1628] pb-12 pt-24 text-white">
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col gap-12 lg:flex-row">
            <div className="lg:w-1/3">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
                <span className="text-accent uppercase tracking-widest text-sm font-bold mb-2 block">By Aeyyyy Traveller's Inn</span>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">Hotel &amp; Poolside Comfort</h2>
                <p className="text-white/70 leading-relaxed text-lg mb-8">
                  Settle into a comfortable room, take a refreshing swim, and enjoy an easygoing stay with the people who matter most.
                </p>
                <Link href="/book">
                  <button type="button" className="flex items-center text-accent font-semibold hover:text-white transition-colors duration-300 group">
                    Explore All <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-2 transition-transform" />
                  </button>
                </Link>
              </motion.div>
            </div>

            <div className="lg:w-2/3">
              <div className="relative">
                <div ref={galleryRef} className="overflow-hidden">
                  <div className="-ml-5 flex touch-pan-y">
                    {hotelGallery.map((item, idx) => (
                      <div
                        key={item.img}
                        className="min-w-0 flex-[0_0_100%] pl-5 md:flex-[0_0_50%]"
                      >
                        <motion.button
                          type="button"
                          onClick={() => setFullscreenIndex(idx)}
                          aria-label={`Open ${item.title} fullscreen`}
                          initial="hidden"
                          whileInView="visible"
                          viewport={{ once: true }}
                          variants={{
                            hidden: { opacity: 0, scale: 0.95 },
                            visible: {
                              opacity: 1,
                              scale: 1,
                              transition: { delay: Math.min(idx, 1) * 0.1, duration: 0.5 },
                            },
                          }}
                          className="relative block h-[340px] w-full cursor-zoom-in overflow-hidden rounded-3xl text-left group active:cursor-grabbing"
                        >
                          <img
                            src={item.img}
                            alt={item.title}
                            draggable={false}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

                          <div className="absolute bottom-0 left-0 flex w-full items-end justify-between p-6">
                            <div>
                              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-accent">
                                {item.sub}
                              </span>
                              <h3 className="text-xl font-bold">{item.title}</h3>
                            </div>
                          </div>
                        </motion.button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => galleryApi?.scrollPrev()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Previous hotel photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryApi?.scrollNext()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Next hotel photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {fullscreenIndex !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Hotel photo gallery"
          onClick={() => setFullscreenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setFullscreenIndex(null)}
            className="absolute right-4 top-4 z-30 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            aria-label="Close fullscreen gallery"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            ref={lightboxRef}
            className="h-[86vh] w-[94vw] overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-full touch-pan-y">
              {hotelGallery.map((item) => (
                <div
                  key={`fullscreen-${item.img}`}
                  className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center px-2 md:px-12"
                >
                  <img
                    src={item.img}
                    alt={item.title}
                    draggable={false}
                    className="max-h-full max-w-full select-none object-contain"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              lightboxApi?.scrollPrev();
            }}
            className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:left-6"
            aria-label="Previous fullscreen photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              lightboxApi?.scrollNext();
            }}
            className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:right-6"
            aria-label="Next fullscreen photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-center text-xs font-semibold text-white backdrop-blur-sm">
            <span className="block">{hotelGallery[fullscreenIndex].title}</span>
            <span className="text-white/60">
              {fullscreenIndex + 1} / {hotelGallery.length}
            </span>
          </div>
        </motion.div>
      )}

      {/* 4. The Difference is Aeyyyy Traveller's Inn */}
      <section className="bg-white py-14 md:py-24">
        <div className="container mx-auto px-6">
          <div className="flex flex-col items-center gap-9 md:gap-12 lg:flex-row lg:gap-16">
            <div className="lg:w-1/2">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
                <h2 className="mb-4 text-3xl font-bold text-[#0a1628] md:mb-6 md:text-5xl">The difference is Aeyyyy Traveller's Inn</h2>
                <p className="mb-6 text-sm leading-relaxed text-gray-600 md:mb-10 md:text-lg">
                  We make every stay simple, comfortable, and welcoming. From restful rooms to relaxing afternoons by the pool, our team is here to help you feel at home.
                </p>

                <div className="space-y-4 md:space-y-8">
                  {[
                    { title: "Warm Hospitality", desc: "Friendly, attentive service that makes every guest feel welcome." },
                    { title: "Poolside Relaxation", desc: "A refreshing outdoor pool for swimming, lounging, and family time." },
                    { title: "Everyday Comfort", desc: "Clean rooms, useful amenities, and peaceful spaces for a restful stay." }
                  ].map((highlight, idx) => (
                    <div key={idx} className="flex items-start">
                      <div className="mr-3 mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f4f8] text-[#00b8d9] md:mr-4 md:h-12 md:w-12">
                        <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6" />
                      </div>
                      <div>
                        <h4 className="mb-0.5 text-base font-bold text-[#0a1628] md:mb-1 md:text-xl">{highlight.title}</h4>
                        <p className="text-sm text-gray-600 md:text-base">{highlight.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="relative min-h-[360px] w-full md:min-h-[600px] lg:w-1/2">
              <motion.img 
                initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}
                src={diff1Img} alt="Luxury Poolside" className="absolute right-0 top-0 z-10 h-[240px] w-4/5 rounded-2xl object-cover shadow-2xl md:h-[400px] md:w-3/4 md:rounded-3xl" 
              />
              <motion.img 
                initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} viewport={{ once: true }}
                src={diff2Img} alt="Hotel dining and kitchen area" className="absolute bottom-0 left-0 z-20 h-[200px] w-3/4 rounded-2xl object-cover shadow-2xl md:h-[350px] md:w-2/3 md:rounded-3xl" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Our Partners */}
      <section className="bg-[#0a1628] py-16 text-white md:py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">Our Partners</h2>
          <p className="mb-10 text-white/60 md:mb-12">Collaborating with leading brands to create exceptional experiences</p>
          
          <div className="overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="partner-marquee-track flex w-max items-center opacity-60 grayscale hover:[animation-play-state:paused]">
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  aria-hidden={copy === 1}
                  className="flex shrink-0 items-center gap-16 pr-16"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                    <div
                      key={`${copy}-${i}`}
                      className="cursor-pointer whitespace-nowrap text-xl font-black uppercase tracking-widest transition-all hover:opacity-100 hover:grayscale-0"
                    >
                      BRAND{i}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Events (admin-managed layouts) */}
      {events.length > 0 && (
        <section
          id="events"
          className="relative isolate overflow-hidden bg-white py-24 text-[#0a1628]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-cyan-100/70 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-sky-100/65 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-12rem] left-1/3 h-96 w-96 rounded-full bg-emerald-100/55 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[12%] top-20 h-20 w-20 rotate-12 rounded-[2rem] border border-accent/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[10%] top-24 h-14 w-14 rounded-full border border-[#0a1628]/10"
          />

          <div className="container relative z-10 mx-auto px-6">
            <div className="mb-14 text-center">
              <motion.h2
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
                className="mb-4 text-4xl font-bold md:text-5xl"
              >
                Upcoming Events
              </motion.h2>
              <p className="mx-auto max-w-2xl text-lg text-gray-600">
                Gatherings and moments at the inn — share them with friends.
              </p>
            </div>

            <div className="space-y-6">
              {featured.map((event) => (
                <EventTile
                  key={event.id}
                  event={event}
                  className={eventLayoutHeight('featured')}
                />
              ))}

              {wide.map((event) => (
                <EventTile
                  key={event.id}
                  event={event}
                  className={eventLayoutHeight('wide')}
                />
              ))}

              {cards.length > 0 && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {cards.map((event) => (
                    <EventTile
                      key={event.id}
                      event={event}
                      className={eventLayoutHeight('card')}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Rules & regulations (admin-managed) */}
      {rules.length > 0 && (
        <section id="rules" className="bg-[#f8fafc] py-24">
          <div className="container mx-auto px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-accent shadow-sm">
                  <ScrollText className="h-5 w-5" />
                </div>
                <h2 className="mb-4 text-4xl font-bold text-[#0a1628] md:text-5xl">
                  Rules &amp; Regulations
                </h2>
                <p className="text-lg text-gray-600">
                  House guidelines so every stay stays comfortable for everyone.
                </p>
              </motion.div>
            </div>

            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
              {rules.map((rule, idx) => (
                <motion.article
                  key={rule.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08, duration: 0.5 }}
                  className="border border-[#0a1628]/8 bg-white p-7 md:p-8"
                >
                  <div className="mb-3 flex items-baseline gap-3">
                    <span className="text-sm font-bold tabular-nums text-accent">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-xl font-bold text-[#0a1628]">{rule.title}</h3>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                    {rule.body}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Booking status checker */}
      <section id="booking-status" className="bg-white py-24">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              className="mb-10 text-center"
            >
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                Guest portal
              </p>
              <h2 className="mb-4 text-4xl font-bold text-[#0a1628] md:text-5xl">
                Check your booking
              </h2>
              <p className="mx-auto max-w-xl text-lg text-gray-600">
                Enter your booking reference and email to see if your request is pending,
                confirmed, declined, cancelled, or rescheduled.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="rounded-[1.5rem] border border-[#0a1628]/8 bg-[#f8fafc] p-6 md:p-8"
            >
              <BookingStatusChecker tone="light" />
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
