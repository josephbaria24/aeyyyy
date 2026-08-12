'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type BookingReferenceData = {
  bookingCode: string;
  name: string;
  email: string;
  phone: string;
  room: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  kind?: 'room' | 'event';
};

function formatDisplayDate(value: string) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type BookingReferenceCardProps = {
  data: BookingReferenceData;
};

export function BookingReferenceCard({ data }: BookingReferenceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `aeyyyy-booking-${data.bookingCode}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Reference image downloaded', {
        description: 'Show this at reception when you arrive.',
      });
    } catch (err) {
      toast.error('Could not download image', {
        description: err instanceof Error ? err.message : 'Please try again',
      });
    } finally {
      setDownloading(false);
    }
  };

  const guests = [
    `${data.adults} adult${data.adults === 1 ? '' : 's'}`,
    data.children > 0
      ? `${data.children} child${data.children === 1 ? '' : 'ren'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div
        ref={cardRef}
        className="overflow-hidden rounded-2xl bg-white text-[#0a1628] shadow-xl"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <div className="bg-[#0a1628] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover ring-1 ring-white/20"
              crossOrigin="anonymous"
            />
            <div className="leading-none">
              <p className="text-xl font-black tracking-tight">Aeyyyy</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Traveller&apos;s Inn
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#ff7a3d]">
            {data.kind === 'event' ? 'Event booking reference' : 'Booking request reference'}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-wide">{data.bookingCode}</p>
          <p className="mt-1 text-xs text-white/60">Pending confirmation · Show at reception</p>
        </div>

        <div className="space-y-3 px-6 py-5 text-sm">
          <Row label="Guest" value={data.name} />
          <Row label="Email" value={data.email} />
          {data.phone ? <Row label="Phone" value={data.phone} /> : null}
          <Row label={data.kind === 'event' ? 'Event' : 'Room'} value={data.room} />
          {data.kind === 'event' ? (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <Row label="From" value={formatDisplayDate(data.checkIn)} />
              <Row label="Until" value={formatDisplayDate(data.checkOut || data.checkIn)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <Row label="Check-in" value={formatDisplayDate(data.checkIn)} />
              <Row label="Check-out" value={formatDisplayDate(data.checkOut)} />
            </div>
          )}
          <Row label={data.kind === 'event' ? 'Spots' : 'Guests'} value={
            data.kind === 'event'
              ? `${data.adults} guest${data.adults === 1 ? '' : 's'}`
              : guests
          } />
        </div>

        <div className="border-t border-dashed border-slate-200 bg-slate-50 px-6 py-3 text-center text-[11px] text-slate-500">
          Present at reception · Check approval anytime at /book/status with this code + your email
        </div>
      </div>

      <button
        type="button"
        onClick={() => void downloadImage()}
        disabled={downloading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {downloading ? 'Preparing image…' : 'Download reference image'}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold text-[#0a1628]">{value}</p>
    </div>
  );
}
