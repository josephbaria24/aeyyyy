import { Suspense } from 'react';
import Booking from '@/views/Booking';

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a1628] text-white">
          Loading…
        </div>
      }
    >
      <Booking />
    </Suspense>
  );
}
