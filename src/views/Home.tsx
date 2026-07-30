'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { EventTile, eventLayoutHeight } from '@/components/EventTile';
import { BookingStatusChecker } from '@/components/BookingStatusChecker';
import { useActiveEvents, useActiveRules } from '@/lib/admin/queries';
import { 
  Waves, BedDouble, UsersRound, ConciergeBell, ArrowRight, ChevronLeft, ChevronRight,
  MapPin, Calendar, User, CheckCircle2, ScrollText
} from 'lucide-react';
import { images } from '@/lib/images';

const heroBg = images.heroBg;
const entranceImg = '/images/gate.png';
const kitchenImg = '/images/kitchen.png';
const poolHeroImg = '/images/hero2.png';
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

  useEffect(() => {
    if (!galleryApi) return;
    const timer = window.setInterval(() => galleryApi.scrollNext(), 4000);
    return () => window.clearInterval(timer);
  }, [galleryApi]);

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
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* 1. Hero Section */}
      <section className="relative h-screen min-h-[800px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="Aeyyyy Traveller's Inn swimming pool" className="w-full h-full object-cover" />
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
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-white/60">Where to?</span>
                <span className="font-medium">Particulars First</span>
              </div>
            </div>
            <div className="flex-1 flex items-center px-6 py-4 border-b md:border-b-0 md:border-r border-white/20 w-full text-white">
              <Calendar className="w-5 h-5 mr-3 text-white" />
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-white/60">Dates</span>
                <span className="font-medium">Nov 10 - Nov 15</span>
              </div>
            </div>
            <div className="flex-1 flex items-center px-6 py-4 w-full text-white">
              <User className="w-5 h-5 mr-3 text-white" />
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-white/60">Guests</span>
                <span className="font-medium">1 Adult - 1 Room</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Our Features */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#0a1628] mb-6">Our Features</h2>
            <p className="text-lg text-gray-600">
              Everything you need for a relaxing hotel stay, from comfortable rooms to refreshing time by the pool.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
                className="bg-gray-50 rounded-3xl p-8 hover:-translate-y-2 transition-transform duration-300 shadow-sm hover:shadow-xl"
              >
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-accent">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#0a1628] mb-4">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
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
                        <motion.div
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
                          className="relative h-[340px] cursor-grab overflow-hidden rounded-3xl group active:cursor-grabbing"
                        >
                          <img
                            src={item.img}
                            alt={item.title}
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
                        </motion.div>
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

      {/* 4. The Difference is Aeyyyy Traveller's Inn */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
                <h2 className="text-4xl md:text-5xl font-bold text-[#0a1628] mb-6">The difference is Aeyyyy Traveller's Inn</h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-10">
                  We make every stay simple, comfortable, and welcoming. From restful rooms to relaxing afternoons by the pool, our team is here to help you feel at home.
                </p>

                <div className="space-y-8">
                  {[
                    { title: "Warm Hospitality", desc: "Friendly, attentive service that makes every guest feel welcome." },
                    { title: "Poolside Relaxation", desc: "A refreshing outdoor pool for swimming, lounging, and family time." },
                    { title: "Everyday Comfort", desc: "Clean rooms, useful amenities, and peaceful spaces for a restful stay." }
                  ].map((highlight, idx) => (
                    <div key={idx} className="flex items-start">
                      <div className="w-12 h-12 rounded-full bg-[#e8f4f8] text-[#00b8d9] flex items-center justify-center flex-shrink-0 mr-4 mt-1">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-[#0a1628] mb-1">{highlight.title}</h4>
                        <p className="text-gray-600">{highlight.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="lg:w-1/2 relative min-h-[600px] w-full">
              <motion.img 
                initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}
                src={diff1Img} alt="Luxury Poolside" className="absolute top-0 right-0 w-3/4 h-[400px] object-cover rounded-3xl shadow-2xl z-10" 
              />
              <motion.img 
                initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} viewport={{ once: true }}
                src={diff2Img} alt="Hotel dining and kitchen area" className="absolute bottom-0 left-0 w-2/3 h-[350px] object-cover rounded-3xl shadow-2xl z-20" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Our Partners */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0a1628] mb-4">Our Partners</h2>
          <p className="text-gray-500 mb-12">Collaborating with leading brands to create exceptional experiences</p>
          
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
