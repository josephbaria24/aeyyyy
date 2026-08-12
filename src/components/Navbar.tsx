'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookNowButton } from '@/components/BookNowChooser';

function parseRgb(color: string): [number, number, number, number] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] === undefined ? 1 : Number(match[4]),
  ];
}

function luminance(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function isElementDark(el: Element | null): boolean {
  let node = el as HTMLElement | null;

  while (node && node !== document.documentElement) {
    if (node.tagName === 'IMG' || node.tagName === 'VIDEO' || node.tagName === 'CANVAS') {
      return true;
    }

    const style = getComputedStyle(node);
    const bgImage = style.backgroundImage;
    if (bgImage && bgImage !== 'none') {
      return true;
    }

    const rgb = parseRgb(style.backgroundColor);
    if (rgb && rgb[3] > 0.15) {
      return luminance(rgb[0], rgb[1], rgb[2]) < 0.55;
    }

    node = node.parentElement;
  }

  return false;
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [onDarkBg, setOnDarkBg] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const update = () => {
      const isScrolled = window.scrollY > 50;
      setScrolled(isScrolled);

      // At the very top over the hero, always treat as dark (white text)
      if (!isScrolled) {
        setOnDarkBg(true);
        return;
      }

      const nav = navRef.current;
      if (!nav) return;

      const rect = nav.getBoundingClientRect();
      const sampleY = Math.min(window.innerHeight - 1, rect.bottom + 8);
      const sampleXs = [
        window.innerWidth * 0.2,
        window.innerWidth * 0.5,
        window.innerWidth * 0.8,
      ];

      nav.style.pointerEvents = 'none';
      let darkVotes = 0;
      for (const x of sampleXs) {
        const under = document.elementFromPoint(x, sampleY);
        if (isElementDark(under)) darkVotes += 1;
      }
      nav.style.pointerEvents = '';

      setOnDarkBg(darkVotes >= 2);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isFloating = scrolled || mobileMenuOpen;
  const useLightText = !isFloating || onDarkBg || mobileMenuOpen;
  const textClass = useLightText ? 'text-white' : 'text-[#0a1628]';
  const compactMobile = pathname === '/' && scrolled;

  return (
    <>
      <motion.nav
        ref={navRef}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          compactMobile ? 'px-2 pt-2 md:px-6 md:pt-4' : `px-4 md:px-6 ${isFloating ? 'pt-4' : 'pt-6'}`
        }`}
      >
        <div
          className={`container mx-auto flex items-center justify-between transition-all duration-300 ${
            isFloating
              ? onDarkBg || mobileMenuOpen
                ? 'glass-nav backdrop-blur-xl rounded-full px-6 py-3'
                : 'rounded-full bg-white px-6 py-3 shadow-md ring-1 ring-black/5'
              : 'px-2 py-0 bg-transparent'
          } ${compactMobile ? '!px-3 !py-2 md:!px-6 md:!py-3' : ''}`}
        >
          <Link
            href="/"
            className={`flex items-center cursor-pointer transition-all duration-300 ${
              compactMobile ? 'gap-2 md:gap-2.5' : 'gap-2.5'
            } ${textClass}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="Aeyyyy Traveller's Inn"
              className={`rounded-full object-cover shadow-sm ring-1 ring-white/20 transition-all ${
                compactMobile ? 'h-8 w-8 md:h-11 md:w-11' : 'h-10 w-10 md:h-11 md:w-11'
              }`}
            />
            <span className="flex flex-col leading-none font-black">
              <span
                className={`font-normal tracking-wide [font-family:var(--font-marck-script)] ${
                  compactMobile ? 'text-xl md:text-2xl' : 'text-2xl'
                }`}
              >
                Aeyyyy
              </span>
              <span
                className={`tracking-[0.15em] opacity-90 ${
                  compactMobile ? 'text-[9px] md:text-xs' : 'text-xs'
                }`}
              >
                TRAVELLER&apos;S INN
              </span>
            </span>
          </Link>

          <div
            className={`hidden md:flex items-center space-x-8 font-medium text-sm transition-colors duration-300 ${textClass}`}
          >
            <Link href="/" className="hover:text-accent transition-colors">
              About Us
            </Link>
            <Link href="/rooms" className="hover:text-accent transition-colors">
              Rooms
            </Link>
            <Link href="/#events" className="hover:text-accent transition-colors">
              Events
            </Link>
            <Link href="/" className="hover:text-accent transition-colors">
              Contact Us
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="/#booking-status"
              className={`hidden text-sm font-medium underline-offset-2 hover:text-accent hover:underline md:inline transition-colors duration-300 ${textClass}`}
            >
              Check booking
            </Link>
            <button className={`hover:text-accent transition-colors duration-300 ${textClass}`}>
              <Search className="w-5 h-5" />
            </button>
            <BookNowButton className="bg-accent text-white px-6 py-2 rounded-full font-semibold hover:scale-105 transition-transform duration-300 cursor-pointer shadow-lg hover:shadow-accent/50 inline-block" />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <BookNowButton
              className={`rounded-full bg-accent font-semibold text-white shadow-lg transition-all hover:scale-105 ${
                compactMobile ? 'px-3 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
              }`}
            />
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className={`transition-colors duration-300 ${textClass}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className={compactMobile ? 'h-5 w-5' : 'h-6 w-6'} />
              ) : (
                <Menu className={compactMobile ? 'h-5 w-5' : 'h-6 w-6'} />
              )}
            </button>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-[#0a1628] pt-24 px-6 flex flex-col items-center space-y-8"
          >
            <Link href="/" className="text-white text-xl font-medium">
              About Us
            </Link>
            <Link href="/rooms" className="text-white text-xl font-medium">
              Rooms
            </Link>
            <Link
              href="/#events"
              className="text-white text-xl font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Events
            </Link>
            <Link href="/" className="text-white text-xl font-medium">
              Contact Us
            </Link>
            <Link href="/#booking-status" className="text-white text-xl font-medium">
              Check booking
            </Link>
            <BookNowButton
              className="bg-accent text-white px-8 py-3 rounded-full font-semibold text-lg inline-block"
              onOpen={() => setMobileMenuOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
