'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { OfferingsHub } from '@/components/admin/events/OfferingsHub';

export default function AdminPoolBookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <OfferingsHub category="pool" />
    </Suspense>
  );
}
