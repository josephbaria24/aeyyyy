'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { images } from '@/lib/images';
import { createClient } from '@/lib/supabase/client';
import { useActiveRooms, useOccupancyStays } from '@/lib/admin/queries';
import { SYSTEM_CURRENCY, calculateStayAmount, formatMoney, nightsBetween } from '@/lib/money';
import { amenityIcon, roomImages } from '@/lib/types/room';
import {
  confirmedStaysForRoom,
  getRoomStatusFromOccupancy,
  getStayAvailability,
  ROOM_LIVE_STATUS_LABEL,
  todayIsoLocal,
  type RoomLiveStatus,
} from '@/lib/room-status';
import { RoomGallery } from '@/components/RoomGallery';
import { BookingReferenceCard, type BookingReferenceData } from '@/components/BookingReferenceCard';
import { StayAvailabilityCalendar } from '@/components/StayAvailabilityCalendar';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const heroBg = images.heroBg;

const fallbackDestinations = [
  'Costa Rica',
  'Marari Beach, India',
  'Thekkady, India',
  'Alleppey, India',
  'Fort Kochi, India',
];

function makeBookingCode() {
  return `BK${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function Booking() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room')?.trim() || '';
  const { data: activeRooms = [] } = useActiveRooms();
  const { data: occupancyStays = [] } = useOccupancyStays();
  const today = todayIsoLocal();

  const roomsByCategory = useMemo(() => {
    if (activeRooms.length === 0) return null;
    const map = new Map<string, string[]>();
    for (const room of activeRooms) {
      const cat = room.category || 'Standard';
      const list = map.get(cat) ?? [];
      list.push(room.name);
      map.set(cat, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activeRooms]);

  const destinations = useMemo(() => {
    if (activeRooms.length > 0) return activeRooms.map((r) => r.name);
    return fallbackDestinations;
  }, [activeRooms]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    destination: roomParam || destinations[0] || 'Costa Rica',
    checkIn: '',
    checkOut: '',
    adults: '2',
    children: '0',
    requests: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bookingCode, setBookingCode] = useState('');
  const [reference, setReference] = useState<BookingReferenceData | null>(null);

  const selectedRoom = useMemo(
    () => activeRooms.find((r) => r.name === formData.destination) ?? null,
    [activeRooms, formData.destination],
  );

  const stayEstimate = useMemo(() => {
    if (!selectedRoom || !formData.checkIn || !formData.checkOut) return null;
    const nights = nightsBetween(formData.checkIn, formData.checkOut);
    if (nights < 1) return null;
    const rate = Number(selectedRoom.price_per_night) || 0;
    const total = calculateStayAmount(rate, formData.checkIn, formData.checkOut, 1);
    return { nights, rate, total };
  }, [selectedRoom, formData.checkIn, formData.checkOut]);

  const liveStatus: RoomLiveStatus | null = useMemo(() => {
    if (!selectedRoom) return null;
    return getRoomStatusFromOccupancy(
      selectedRoom,
      occupancyStays,
      formData.checkIn || today,
    );
  }, [selectedRoom, occupancyStays, formData.checkIn, today]);

  const stayAvailability = useMemo(
    () =>
      getStayAvailability(
        selectedRoom,
        occupancyStays,
        formData.checkIn,
        formData.checkOut,
      ),
    [selectedRoom, occupancyStays, formData.checkIn, formData.checkOut],
  );

  const upcomingBlocks = useMemo(() => {
    if (!selectedRoom) return [];
    return confirmedStaysForRoom(selectedRoom, occupancyStays).slice(0, 4);
  }, [selectedRoom, occupancyStays]);

  const roomStays = useMemo(() => {
    if (!selectedRoom) return [];
    return confirmedStaysForRoom(selectedRoom, occupancyStays);
  }, [selectedRoom, occupancyStays]);

  const availabilityBlocked = stayAvailability.kind !== 'open';

  useEffect(() => {
    if (!destinations.length) return;
    setFormData((prev) => {
      if (roomParam && destinations.includes(roomParam)) {
        return { ...prev, destination: roomParam };
      }
      if (!destinations.includes(prev.destination)) {
        return { ...prev, destination: destinations[0] };
      }
      return prev;
    });
  }, [destinations, roomParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const supabase = createClient();
      const code = makeBookingCode();
      const room =
        activeRooms.find((r) => r.name === formData.destination) ?? selectedRoom;
      const rate = room ? Number(room.price_per_night) || 0 : 0;
      const amount = room
        ? calculateStayAmount(rate, formData.checkIn, formData.checkOut, 1)
        : 0;

      if (!formData.checkIn || !formData.checkOut) {
        throw new Error('Check-in and check-out dates are required');
      }
      if (nightsBetween(formData.checkIn, formData.checkOut) < 1) {
        throw new Error('Check-out must be after check-in');
      }

      const availability = getStayAvailability(
        room,
        occupancyStays,
        formData.checkIn,
        formData.checkOut,
      );
      if (availability.kind === 'unavailable') {
        throw new Error('This room is temporarily unavailable. Please choose another room.');
      }
      if (availability.kind === 'conflict') {
        throw new Error(
          `Those dates overlap a confirmed stay (${availability.stay.check_in} → ${availability.stay.check_out}). Please pick different dates.`,
        );
      }

      const { error: insertError } = await supabase.from('bookings').insert({
        booking_code: code,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        destination: formData.destination,
        check_in: formData.checkIn,
        check_out: formData.checkOut,
        adults: Number(formData.adults),
        children: Number(formData.children) || 0,
        rooms: 1,
        requests: formData.requests || null,
        status: 'pending',
        rate_per_night: rate,
        amount,
        amount_paid: 0,
        other_charges: [],
        currency: SYSTEM_CURRENCY,
      });

      if (insertError) throw insertError;

      const refData: BookingReferenceData = {
        bookingCode: code,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        room: formData.destination,
        checkIn: formData.checkIn,
        checkOut: formData.checkOut,
        adults: Number(formData.adults),
        children: Number(formData.children) || 0,
      };

      setBookingCode(code);
      setReference(refData);
      setSubmitted(true);
      toast.success('Booking requested', {
        description: `Reference ${code}. Download your reception slip below.`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save booking. Please try again.';
      setError(message);
      toast.error('Booking failed', { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setBookingCode('');
    setReference(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      destination: destinations[0] || 'Costa Rica',
      checkIn: '',
      checkOut: '',
      adults: '2',
      children: '0',
      requests: '',
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#0a1628]">
      <Navbar />

      <main className="relative flex min-h-screen flex-grow items-start justify-center pb-8 pt-24 sm:pb-14 sm:pt-28 lg:min-h-[900px] lg:items-center lg:pb-24 lg:pt-32">
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="Background" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-[#0a1628]/80 backdrop-blur-sm"></div>
        </div>

        <div className="container relative z-10 mx-auto w-full max-w-5xl px-1.5 sm:px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass-dark relative rounded-xl p-3 pt-16 sm:rounded-2xl sm:p-6 sm:pt-16 md:rounded-3xl md:p-12"
          >
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/rooms');
                }
              }}
              className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/20 hover:text-white sm:left-4 sm:top-4 sm:px-3 sm:py-2 sm:text-sm md:left-6 md:top-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="mb-6 text-center sm:mb-8 md:mb-10">
              <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl md:mb-4 md:text-5xl">Book Your Stay</h1>
              <p className="text-sm text-white/70 sm:text-base">Reserve your sanctuary in our curated destinations.</p>
            </div>

            {submitted && reference ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-green-500/40 bg-green-500/15 px-6 py-6 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-400" />
                  <h3 className="mb-2 text-2xl font-bold text-white">Booking Requested</h3>
                  <p className="text-sm text-white/80">
                    Thank you, {reference.name}. Save the image below and show it at reception
                    with reference <span className="font-semibold text-white">{bookingCode}</span>.
                    You can check whether it&apos;s been approved anytime below or at{' '}
                    <Link href="/#booking-status" className="font-semibold text-accent hover:underline">
                      Check booking status
                    </Link>
                    .
                  </p>
                </div>

                <BookingReferenceCard data={reference} />

                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
                  <Link
                    href="/#booking-status"
                    className="inline-flex items-center justify-center rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Check approval status
                  </Link>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
                  >
                    Submit another request
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
                {selectedRoom && (
                  <div className="space-y-3 sm:space-y-4">
                    <RoomGallery
                      key={selectedRoom.id}
                      images={roomImages(selectedRoom)}
                      alt={selectedRoom.name}
                      tone="dark"
                      aspectClassName="aspect-[4/3]"
                      className="overflow-hidden rounded-2xl"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                          {selectedRoom.category || 'Standard'}
                        </p>
                        {liveStatus && (
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                              liveStatus === 'available' && 'bg-emerald-500/20 text-emerald-200',
                              liveStatus === 'reserved' && 'bg-sky-500/20 text-sky-200',
                              liveStatus === 'occupied' && 'bg-amber-500/20 text-amber-100',
                              liveStatus === 'unavailable' && 'bg-white/15 text-white/70',
                            )}
                          >
                            {ROOM_LIVE_STATUS_LABEL[liveStatus]}
                            {formData.checkIn ? ` · ${formData.checkIn}` : ' · today'}
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1 text-2xl font-bold text-white">{selectedRoom.name}</h2>
                      <p className="mt-1 text-white/70">
                        {formatMoney(selectedRoom.price_per_night)}
                        <span className="text-white/45"> / night</span>
                        <span className="mx-2 text-white/30">·</span>
                        Up to {selectedRoom.capacity} guests
                      </p>
                      {selectedRoom.description && (
                        <p className="mt-3 text-sm leading-relaxed text-white/65">
                          {selectedRoom.description}
                        </p>
                      )}
                      {selectedRoom.amenities.length > 0 && (
                        <ul className="mt-4 flex flex-wrap gap-2">
                          {selectedRoom.amenities.slice(0, 10).map((item) => (
                            <li
                              key={item}
                              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
                            >
                              <Icon icon={amenityIcon(item)} width={13} height={13} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                      {upcomingBlocks.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                            Confirmed stays
                          </p>
                          <ul className="mt-2 space-y-1">
                            {upcomingBlocks.map((stay) => (
                              <li
                                key={`${stay.check_in}-${stay.check_out}`}
                                className="text-xs text-white/70"
                              >
                                {stay.check_in} → {stay.check_out}
                                <span className="text-white/40">
                                  {' '}
                                  · {nightsBetween(stay.check_in, stay.check_out)} night
                                  {nightsBetween(stay.check_in, stay.check_out) === 1 ? '' : 's'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {error && (
                  <div className="rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-center text-sm text-red-200">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                  <div>
                    <label className="block text-white/80 text-sm mb-2">Full Name</label>
                    <input
                      required
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm mb-2">Email Address</label>
                    <input
                      required
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm mb-2">Phone Number</label>
                    <input
                      required
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm mb-2">
                      {activeRooms.length > 0 ? 'Room' : 'Destination'}
                    </label>
                    <select
                      name="destination"
                      value={formData.destination}
                      onChange={handleChange}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors appearance-none"
                    >
                      {roomsByCategory
                        ? roomsByCategory.map(([category, names]) => (
                            <optgroup key={category} label={category} className="bg-[#0a1628] text-white">
                              {names.map((name) => {
                                const room = activeRooms.find((r) => r.name === name);
                                const blocked = room?.availability === 'unavailable';
                                return (
                                  <option
                                    key={name}
                                    className="bg-[#0a1628] text-white"
                                    value={name}
                                  >
                                    {name}
                                    {blocked ? ' (Temporarily unavailable)' : ''}
                                  </option>
                                );
                              })}
                            </optgroup>
                          ))
                        : destinations.map((name) => (
                            <option key={name} className="bg-[#0a1628] text-white" value={name}>
                              {name}
                            </option>
                          ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm text-white/80">Stay dates</label>
                    <StayAvailabilityCalendar
                      checkIn={formData.checkIn}
                      checkOut={formData.checkOut}
                      stays={roomStays}
                      roomUnavailable={selectedRoom?.availability === 'unavailable'}
                      onChange={({ checkIn, checkOut }) =>
                        setFormData((prev) => ({ ...prev, checkIn, checkOut }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm mb-2">Adults</label>
                    <select
                      name="adults"
                      value={formData.adults}
                      onChange={handleChange}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors appearance-none"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} className="bg-[#0a1628]" value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm mb-2">Children</label>
                    <select
                      name="children"
                      value={formData.children}
                      onChange={handleChange}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors appearance-none"
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} className="bg-[#0a1628]" value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {stayAvailability.kind === 'unavailable' && (
                  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/80">
                    This room is <span className="font-semibold text-white">temporarily unavailable</span>.
                    Choose another room, or check back later.
                  </div>
                )}

                {stayAvailability.kind === 'conflict' && (
                  <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
                    Those dates overlap a confirmed stay (
                    <span className="font-semibold">
                      {stayAvailability.stay.check_in} → {stayAvailability.stay.check_out}
                    </span>
                    ). Pick different check-in / check-out dates.
                  </div>
                )}

                {stayEstimate && stayAvailability.kind === 'open' && (
                  <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-sm text-white/80">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                          Estimated stay
                        </p>
                        <p className="mt-1">
                          {formatMoney(stayEstimate.rate)} / night × {stayEstimate.nights} night
                          {stayEstimate.nights === 1 ? '' : 's'}
                        </p>
                        <p className="mt-1 text-xs text-emerald-300/90">Dates look available for this room.</p>
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {formatMoney(stayEstimate.total)}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-white/80 text-sm mb-2">Special Requests (Optional)</label>
                  <textarea
                    name="requests"
                    value={formData.requests}
                    onChange={handleChange}
                    rows={3}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors resize-none"
                  ></textarea>
                </div>

                <div className="pt-2 text-center sm:pt-4">
                  <button
                    type="submit"
                    disabled={submitting || availabilityBlocked}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-8 py-3.5 font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-accent/90 disabled:opacity-60 sm:px-12 sm:py-4 md:w-auto"
                  >
                    {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
                    {submitting
                      ? 'Submitting...'
                      : availabilityBlocked
                        ? 'Dates unavailable'
                        : 'Submit Request'}
                  </button>
                </div>
              </form>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
