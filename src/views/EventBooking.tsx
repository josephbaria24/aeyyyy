'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, BedDouble, CheckCircle2, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BookingReferenceCard } from '@/components/BookingReferenceCard';
import { RoomGallery } from '@/components/RoomGallery';
import { EventAreaCalendar } from '@/components/EventAreaCalendar';
import { createClient } from '@/lib/supabase/client';
import { useActiveEvents, useActiveOfferings, useEventOccupancyStays } from '@/lib/admin/queries';
import { makeEventBookingCode, roomBookingHrefFromEvent } from '@/lib/types/event-booking';
import { eventAreaImages, type EventOffering } from '@/lib/types/event-offering';
import { formatMoney, SYSTEM_CURRENCY } from '@/lib/money';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const inputClass =
  'rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm placeholder:text-white/35';

export default function EventBooking() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const slugParam = searchParams.get('slug')?.trim() || '';
  const { data: offerings = [], isPending: offeringsPending } = useActiveOfferings();
  const { data: events = [], isPending: eventsPending } = useActiveEvents();
  const { data: occupancy = { stays: [], unavailable: [] } } = useEventOccupancyStays();
  const isPending = offeringsPending || eventsPending;

  const datedEvents = useMemo(
    () => events.filter((event) => event.is_bookable && event.event_date),
    [events],
  );

  const [selectedId, setSelectedId] = useState('');
  const selected: EventOffering | null = useMemo(
    () =>
      offerings.find((item) => item.id === selectedId) ??
      offerings.find((item) => item.slug === slugParam) ??
      offerings[0] ??
      null,
    [offerings, selectedId, slugParam],
  );

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    guests: '1',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    requests: '',
  });
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState<{
    id: string;
    code: string;
    title: string;
    guests: number;
    startDate: string;
    endDate: string;
  } | null>(null);

  useEffect(() => {
    if (slugParam) {
      const match = offerings.find((item) => item.slug === slugParam);
      if (match) setSelectedId(match.id);
    }
  }, [offerings, slugParam]);

  const guests = Math.max(1, Number(form.guests) || 1);
  const overCapacity = selected != null && selected.capacity > 0 && guests > selected.capacity;
  const total = selected ? selected.price * guests : 0;
  const endDate = form.endDate || form.startDate;
  const areaUnavailable =
    selected?.availability === 'unavailable' ||
    (selected != null && occupancy.unavailable.includes(selected.id));

  const areaStays = useMemo(() => {
    if (!selected) return [];
    return occupancy.stays.filter((stay) => stay.offeringId === selected.id);
  }, [occupancy.stays, selected]);

  const photos = selected ? eventAreaImages(selected) : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (areaUnavailable) {
      toast.error('This area is not available right now');
      return;
    }
    if (!form.startDate) {
      toast.error('Choose when you need the area');
      return;
    }
    if (endDate < form.startDate) {
      toast.error('“Until when” must be on or after the start date');
      return;
    }
    if (overCapacity) {
      toast.error(`This area allows up to ${selected.capacity} guests`);
      return;
    }
    const blocked = areaStays.some(
      (stay) => form.startDate < stay.check_out && endDate >= stay.check_in,
    );
    if (blocked) {
      toast.error('Those dates are already reserved for this area');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const code = makeEventBookingCode();
      const bookingId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : undefined;
      const { error } = await supabase.from('event_bookings').insert({
        ...(bookingId ? { id: bookingId } : {}),
        booking_code: code,
        event_id: null,
        offering_id: selected.id,
        event_title: selected.title,
        event_date: form.startDate,
        event_end_date: endDate,
        start_time: form.startTime || null,
        end_time: form.endTime || null,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        guests,
        requests: form.requests.trim() || null,
        status: 'pending',
        amount: total,
        amount_paid: 0,
        currency: SYSTEM_CURRENCY,
      });
      if (error) throw error;
      if (!bookingId) {
        throw new Error('Could not create booking id. Please try again.');
      }
      await queryClient.invalidateQueries({ queryKey: ['public', 'event-occupancy'] });
      setSubmitted({
        id: bookingId,
        code,
        title: selected.title,
        guests,
        startDate: form.startDate,
        endDate,
      });
      toast.success('Event booking submitted', { description: `Reference ${code}` });
    } catch (err) {
      const message =
        err instanceof Error
          ? `${err.message} — run supabase/event-areas-schema.sql if columns are missing.`
          : 'Could not submit booking';
      toast.error('Could not submit booking', { description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-28 md:px-6 md:pt-32">
        <Link
          href="/#events"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Link>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="font-semibold">Request received</p>
                <p className="mt-1 text-sm text-white/70">
                  We’ll confirm your {submitted.title} booking. Check status anytime with code{' '}
                  {submitted.code}.
                </p>
              </div>
            </div>
            <BookingReferenceCard
              data={{
                bookingCode: submitted.code,
                name: form.name,
                email: form.email,
                phone: form.phone,
                room: submitted.title,
                checkIn: submitted.startDate,
                checkOut: submitted.endDate,
                adults: submitted.guests,
                children: 0,
                kind: 'event',
              }}
            />
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <BedDouble className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Also need a room to stay?</p>
                  <p className="mt-1 text-sm text-white/65">
                    Book overnight rooms for your party. Your details and event dates will be filled in,
                    and both bookings stay linked for the inn team.
                  </p>
                  <Link
                    href={roomBookingHrefFromEvent({
                      eventBookingId: submitted.id,
                      eventCode: submitted.code,
                      name: form.name.trim(),
                      email: form.email.trim(),
                      phone: form.phone.trim(),
                      startDate: submitted.startDate,
                      endDate: submitted.endDate,
                      guests: submitted.guests,
                    })}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
                  >
                    Book a room
                    <BedDouble className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            <h1 className="text-3xl font-bold md:text-4xl">Book an area</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              Choose a space, pick dates on the calendar, and tell us what you’re celebrating.
            </p>

            {isPending ? (
              <div className="mt-16 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            ) : offerings.length === 0 ? (
              <p className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-5 py-8 text-center text-sm text-white/70">
                No event areas are open yet. Check back soon, or{' '}
                <Link href="/rooms" className="text-accent underline">
                  book a room
                </Link>
                .
              </p>
            ) : (
              <form onSubmit={(e) => void submit(e)} className="mt-8 grid gap-8 lg:grid-cols-5">
                <div className="space-y-4 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                    Choose an area
                  </p>
                  <div className="space-y-2">
                    {offerings.map((item) => {
                      const cover = eventAreaImages(item)[0];
                      const closed =
                        item.availability === 'unavailable' ||
                        occupancy.unavailable.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(item.id);
                            setForm((prev) => ({ ...prev, startDate: '', endDate: '' }));
                          }}
                          className={cn(
                            'flex w-full gap-3 overflow-hidden rounded-2xl border text-left transition',
                            selected?.id === item.id
                              ? 'border-accent bg-accent/15'
                              : 'border-white/10 bg-white/5 hover:border-white/25',
                          )}
                        >
                          <div className="h-20 w-24 shrink-0 bg-white/5">
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={cover} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0 py-3 pr-3">
                            <p className="font-semibold">
                              {item.title}
                              {closed && (
                                <span className="ml-2 text-[11px] font-medium text-rose-300">
                                  Unavailable
                                </span>
                              )}
                            </p>
                            {item.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-white/55">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-3">
                  {selected && (
                    <div className="mb-5 space-y-4">
                      {photos.length > 0 && (
                        <RoomGallery
                          images={photos}
                          alt={selected.title}
                          tone="dark"
                          aspectClassName="aspect-[16/10]"
                        />
                      )}
                      <div>
                        <p className="text-lg font-bold">{selected.title}</p>
                        {selected.description && (
                          <p className="mt-1 text-sm text-white/65">{selected.description}</p>
                        )}
                        {selected.notes && (
                          <p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                            {selected.notes}
                          </p>
                        )}
                        <p className="mt-3 text-sm text-white/80">
                          {selected.price > 0
                            ? `${formatMoney(selected.price)} per guest`
                            : 'Price confirmed after we review your request'}
                          {selected.capacity > 0 ? ` · up to ${selected.capacity} guests` : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="mb-2 text-xs text-white/50">Dates</p>
                    <EventAreaCalendar
                      from={form.startDate}
                      until={form.endDate}
                      stays={areaStays}
                      areaUnavailable={areaUnavailable}
                      onChange={({ from, until }) =>
                        setForm((prev) => ({ ...prev, startDate: from, endDate: until }))
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      required
                      placeholder="Full name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      required
                      type="email"
                      placeholder="Email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      required
                      type="number"
                      min={1}
                      max={selected?.capacity || undefined}
                      placeholder="Number of guests"
                      value={form.guests}
                      onChange={(e) => setForm({ ...form, guests: e.target.value })}
                      className={inputClass}
                    />
                    <label className="text-xs text-white/50">
                      Starts at
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        className={`${inputClass} mt-1 w-full`}
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      Until when (time)
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        className={`${inputClass} mt-1 w-full`}
                      />
                    </label>
                    <textarea
                      placeholder="What are you celebrating? Setup, cake, extra requests…"
                      rows={3}
                      value={form.requests}
                      onChange={(e) => setForm({ ...form, requests: e.target.value })}
                      className={`${inputClass} sm:col-span-2`}
                    />
                  </div>

                  {overCapacity && (
                    <p className="mt-3 text-xs text-rose-300">
                      This area allows up to {selected?.capacity} guests.
                    </p>
                  )}
                  {areaUnavailable && (
                    <p className="mt-3 text-xs text-rose-300">
                      This area is currently unavailable.
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-white/55">Estimated total</span>
                    <span className="font-semibold">{formatMoney(total)}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={saving || overCapacity || !selected || areaUnavailable}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? 'Submitting…' : 'Request booking'}
                  </button>
                </div>
              </form>
            )}

            {datedEvents.length > 0 && (
              <p className="mt-10 text-center text-xs text-white/40">
                Looking for a listed concert or dinner? Those are on the{' '}
                <Link href="/#events" className="text-accent underline">
                  events
                </Link>{' '}
                section of the homepage.
              </p>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
