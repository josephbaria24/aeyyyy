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

const choices = [
  {
    href: '/rooms',
    title: 'Room',
    detail: 'Overnight stay',
    icon: BedDouble,
  },
  {
    href: '/book/pool',
    title: 'Pool',
    detail: 'Day-use swimming',
    icon: Waves,
  },
  {
    href: '/book/event',
    title: 'Event',
    detail: 'Hall or celebration area',
    icon: PartyPopper,
  },
] as const;

export function BookNowChooser({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-white/10 bg-[#0a1628] p-4 text-white sm:p-5 [&>button]:text-white [&>button]:opacity-80">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-bold text-white">What would you like to book?</DialogTitle>
          <DialogDescription className="text-sm text-white/65">
            Choose a room, the pool, or an event space.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {choices.map((choice) => {
            const Icon = choice.icon;
            return (
              <Link
                key={choice.href}
                href={choice.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex min-w-0 flex-col items-center rounded-xl border border-white/12 bg-white/5 px-2 py-3 text-center transition',
                  'hover:border-accent/70 hover:bg-accent/10',
                )}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-2 text-sm font-semibold text-white">{choice.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/60">{choice.detail}</p>
              </Link>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
