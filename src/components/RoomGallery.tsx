'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type RoomGalleryProps = {
  images: string[];
  alt: string;
  className?: string;
  aspectClassName?: string;
  tone?: 'light' | 'dark';
};

export function RoomGallery({
  images,
  alt,
  className,
  aspectClassName = 'aspect-[4/3]',
  tone = 'light',
}: RoomGalleryProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const list = images.filter(Boolean);
  const safeIndex = Math.min(index, Math.max(list.length - 1, 0));
  const current = list[safeIndex];

  useEffect(() => {
    if (!fullscreen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'ArrowLeft') {
        setDirection(-1);
        setIndex((i) => (i - 1 + list.length) % list.length);
      }
      if (e.key === 'ArrowRight') {
        setDirection(1);
        setIndex((i) => (i + 1) % list.length);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen, list.length]);

  if (list.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm',
          aspectClassName,
          tone === 'dark' ? 'bg-white/5 text-white/40' : 'bg-[#0a1628]/5 text-[#0a1628]/35',
          className,
        )}
      >
        No photos yet
      </div>
    );
  }

  const go = (dir: -1 | 1) => {
    setDirection(dir);
    setIndex((i) => (i + dir + list.length) % list.length);
  };

  const show = (nextIndex: number) => {
    setDirection(nextIndex >= safeIndex ? 1 : -1);
    setIndex(nextIndex);
  };

  return (
    <>
      <div className={cn('overflow-hidden', className)}>
        <div className={cn('relative overflow-hidden', aspectClassName)}>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="absolute inset-0 z-0 block h-full w-full cursor-zoom-in"
            aria-label={`View ${alt} fullscreen`}
          >
            <AnimatePresence initial={false} custom={direction}>
              <motion.img
                key={current}
                src={current}
                alt={`${alt} — photo ${safeIndex + 1}`}
                custom={direction}
                initial={{ x: direction > 0 ? '100%' : '-100%', opacity: 0.75 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? '-100%' : '100%', opacity: 0.75 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            </AnimatePresence>
          </button>
          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
                aria-label="Next photo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                {safeIndex + 1} / {list.length}
              </span>
            </>
          )}
        </div>

        {list.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {list.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => show(i)}
                className={cn(
                  'h-14 w-20 shrink-0 overflow-hidden rounded-[7px] ring-2 transition',
                  i === index
                    ? 'ring-accent'
                    : tone === 'dark'
                      ? 'ring-transparent opacity-70 hover:opacity-100'
                      : 'ring-transparent opacity-80 hover:opacity-100',
                )}
                aria-label={`Show photo ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} fullscreen gallery`}
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            aria-label="Close fullscreen"
          >
            <X className="h-5 w-5" />
          </button>

          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:left-6"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:right-6"
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <span className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white">
                {safeIndex + 1} / {list.length}
              </span>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt={`${alt} — photo ${safeIndex + 1}`}
            className="max-h-[92vh] max-w-[96vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
