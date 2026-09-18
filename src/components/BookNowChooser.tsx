'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BedDouble, PartyPopper, Waves } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type BookNowButtonProps = {
  className?: string;
  onOpen?: () => void;
};

export function BookNowButton({ className, onOpen }: BookNowButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        Book Now
      </button>
      <BookNowChooser open={open} onOpenChange={setOpen} />
    </>
  );
}

export function BookNowChooser({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(32rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-white/10 bg-[#0a1628] p-6 text-white sm:rounded-2xl [&>button]:text-white [&>button]:opacity-80">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-bold text-white">What would you like to book?</DialogTitle>
          <DialogDescription className="text-white/65">
            Stay overnight, swim for the day, or reserve a space for a celebration.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/rooms"
            onClick={() => onOpenChange(false)}
            className={cn(
              'group rounded-2xl border border-white/12 bg-white/5 p-5 text-left transition',
              'hover:border-accent/70 hover:bg-accent/10',
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-accent">
              <BedDouble className="h-5 w-5" />
            </span>
            <p className="mt-4 text-base font-semibold text-white">Room</p>
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              Overnight stay in a guest room.
            </p>
          </Link>

          <Link
            href="/book/pool"
            onClick={() => onOpenChange(false)}
            className={cn(
              'group rounded-2xl border border-white/12 bg-white/5 p-5 text-left transition',
              'hover:border-accent/70 hover:bg-accent/10',
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-accent">
              <Waves className="h-5 w-5" />
            </span>
            <p className="mt-4 text-base font-semibold text-white">Pool</p>
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              Day-use swimming for family and friends.
            </p>
          </Link>

          <Link
            href="/book/event"
            onClick={() => onOpenChange(false)}
            className={cn(
              'group rounded-2xl border border-white/12 bg-white/5 p-5 text-left transition',
              'hover:border-accent/70 hover:bg-accent/10',
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-accent">
              <PartyPopper className="h-5 w-5" />
            </span>
            <p className="mt-4 text-base font-semibold text-white">Event</p>
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              Reserve the hall or another celebration area.
            </p>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
