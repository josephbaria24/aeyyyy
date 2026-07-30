'use client';

/**
 * @author: @dorianbaffier
 * @description: Carousel Cards
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { SYSTEM_CURRENCY_SYMBOL } from '@/lib/money';
import { cn } from '@/lib/utils';

export type CarouselCardItem = {
  id: string;
  title: string;
  image: string;
  location: string;
  price: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  /** Secondary badge (e.g. Temporarily unavailable). */
  statusBadge?: string;
  date?: string;
  href?: string;
  /** Shown after the price, e.g. "night" → "₱ 120 / night" */
  priceUnit?: string;
  disabled?: boolean;
};

type CarouselSectionProps = {
  title: string;
  items: CarouselCardItem[];
  viewAllHref?: string;
  className?: string;
};

function CarouselCard({ item }: { item: CarouselCardItem }) {
  const currency = item.currency ?? SYSTEM_CURRENCY_SYMBOL;
  const unit = item.priceUnit ?? 'night';

  return (
    <Card
      className={cn(
        'group relative flex h-[320px] w-full flex-col overflow-hidden rounded-xl border-0 shadow-sm transition-shadow duration-300 hover:shadow-md',
        item.disabled && 'opacity-80',
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-slate-100">
        {item.image ? (
          <Image
            alt={item.title}
            className={cn(
              'object-cover transition-transform duration-300 group-hover:scale-105',
              item.disabled && 'grayscale-[0.35]',
            )}
            fill
            sizes="260px"
            src={item.image}
            unoptimized={item.image.startsWith('http') && !item.image.includes('res.cloudinary.com')}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            No photo
          </div>
        )}
        {item.badge && (
          <Badge className="absolute top-2 left-2 rounded-md bg-white/90 px-1.5 py-0.5 font-medium text-black text-xs">
            {item.badge}
          </Badge>
        )}
        {item.statusBadge && (
          <Badge className="absolute top-2 right-2 rounded-md bg-slate-900/85 px-1.5 py-0.5 font-medium text-white text-xs">
            {item.statusBadge}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <CardContent className="p-2 pt-3 pb-0">
          <h3 className="line-clamp-2 font-medium text-sm tracking-tight">{item.title}</h3>
          <p className="text-muted-foreground text-xs tracking-tight">{item.location}</p>
          {item.date && (
            <p className="line-clamp-1 text-muted-foreground text-xs tracking-tight">{item.date}</p>
          )}
        </CardContent>

        <CardFooter className="mt-auto flex items-center gap-0.5 p-2 pt-0 text-xs">
          {item.rating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-current" />
              {item.rating}
            </span>
          )}
          {item.reviewCount != null && item.reviewCount > 0 && (
            <span className="text-muted-foreground text-xs tracking-tight">
              {item.rating != null && '·'} ({item.reviewCount})
            </span>
          )}
          <span className="ml-auto text-xs tracking-tight">
            {currency} {Number(item.price).toLocaleString()} / {unit}
          </span>
        </CardFooter>
      </div>
    </Card>
  );
}

export function CarouselSection({
  title,
  items,
  viewAllHref,
  className,
}: CarouselSectionProps) {
  const scrollContainer = React.useRef<HTMLDivElement>(null);

  const handleScrollLeft = () => {
    scrollContainer.current?.scrollBy({ left: -320, behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    scrollContainer.current?.scrollBy({ left: 320, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <div className={cn('w-full py-4', className)}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium text-lg tracking-tight md:text-xl">{title}</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            className="h-7 w-7 rounded-full border-neutral-200 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
            onClick={handleScrollLeft}
            size="icon"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Scroll left</span>
          </Button>
          <Button
            type="button"
            className="h-7 w-7 rounded-full border-neutral-200 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
            onClick={handleScrollRight}
            size="icon"
            variant="outline"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Scroll right</span>
          </Button>
          {viewAllHref ? (
            <Link
              className="ml-1 hidden font-medium text-xs hover:underline md:block"
              href={viewAllHref}
            >
              Show all
            </Link>
          ) : null}
        </div>
      </div>

      <div
        className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
        ref={scrollContainer}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {items.map((item) => {
          const card = <CarouselCard item={item} />;
          return (
            <div className="w-[240px] flex-none snap-start md:w-[260px]" key={item.id}>
              {item.href ? (
                <Link
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  href={item.href}
                >
                  {card}
                </Link>
              ) : (
                card
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CarouselCards({
  sections,
}: {
  sections?: { title: string; items: CarouselCardItem[]; viewAllHref?: string }[];
}) {
  if (!sections?.length) return null;

  return (
    <div className="mt-4 w-full space-y-4">
      {sections.map((section) => (
        <CarouselSection
          key={section.title}
          items={section.items}
          title={section.title}
          viewAllHref={section.viewAllHref}
        />
      ))}
    </div>
  );
}
