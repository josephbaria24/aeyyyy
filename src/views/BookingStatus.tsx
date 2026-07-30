'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BookingStatusChecker } from '@/components/BookingStatusChecker';
import { images } from '@/lib/images';

export default function BookingStatusPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a1628]">
      <Navbar />

      <main className="relative flex flex-grow items-center justify-center px-6 pb-24 pt-32">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images.heroBg} alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-[#0a1628]/80 backdrop-blur-sm" />
        </div>

        <div className="relative z-10 w-full max-w-lg">
          <Link
            href="/book"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to booking
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-dark rounded-3xl p-8 md:p-10"
          >
            <h1 className="mb-2 text-3xl font-bold text-white">Check booking status</h1>
            <p className="mb-8 text-sm text-white/70">
              Enter the reference code from your downloadable slip and the email you used when
              booking. You&apos;ll see pending, confirmed, declined, cancelled, or rescheduled.
            </p>

            <BookingStatusChecker tone="dark" />
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
