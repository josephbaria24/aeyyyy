import { Suspense } from 'react';
import EventBooking from '@/views/EventBooking';

export default function BookPoolPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a1628] text-white">
          Loading…
        </div>
      }
    >
      <EventBooking category="pool" />
    </Suspense>
  );
}
