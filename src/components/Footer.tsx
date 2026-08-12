'use client';

import Link from 'next/link';
import { Instagram, Facebook, Twitter, Linkedin } from 'lucide-react';
import { usePublicSiteSettings } from '@/lib/admin/queries';
import { DEFAULT_SITE_SETTINGS, phoneHref } from '@/lib/types/site';

export function Footer() {
  const { data } = usePublicSiteSettings();
  const s = data ?? DEFAULT_SITE_SETTINGS;
  const socials = [
    { href: s.footer_instagram, icon: Instagram, label: 'Instagram' },
    { href: s.footer_facebook, icon: Facebook, label: 'Facebook' },
    { href: s.footer_twitter, icon: Twitter, label: 'Twitter' },
    { href: s.footer_linkedin, icon: Linkedin, label: 'LinkedIn' },
  ].filter((item) => item.href.trim());

  return (
    <footer className="relative bg-[#060d1a] text-white py-20 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none select-none overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo.png"
          alt=""
          aria-hidden
          className="h-[min(70vw,28rem)] w-[min(70vw,28rem)] rounded-full object-cover"
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo.png"
                alt="Aeyyyy Traveller's Inn"
                className="h-14 w-14 rounded-full object-cover ring-1 ring-white/15"
              />
              <div className="flex flex-col leading-none text-white font-black">
                <span className="text-2xl">Aeyyyy</span>
                <span className="text-sm tracking-[0.15em] opacity-90">TRAVELLER&apos;S INN</span>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">{s.footer_blurb}</p>
            {socials.length > 0 && (
              <div className="flex space-x-4">
                {socials.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-accent transition-colors duration-300"
                  >
                    <item.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-4 text-white/60 text-sm">
              <li><Link href="/" className="hover:text-accent cursor-pointer transition-colors">Our Story</Link></li>
              <li><Link href="/rooms" className="hover:text-accent cursor-pointer transition-colors">Rooms</Link></li>
              <li><Link href="/#events" className="hover:text-accent cursor-pointer transition-colors">Events</Link></li>
              <li><Link href="/book/event" className="hover:text-accent cursor-pointer transition-colors">Book an event</Link></li>
              <li><Link href="/book" className="hover:text-accent cursor-pointer transition-colors">Book a room</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-6">Terms</h3>
            <ul className="space-y-4 text-white/60 text-sm">
              <li>
                <Link href={s.footer_privacy_url || '/'} className="hover:text-accent cursor-pointer transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href={s.footer_terms_url || '/'} className="hover:text-accent cursor-pointer transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href={s.footer_cancellation_url || '/'} className="hover:text-accent cursor-pointer transition-colors">
                  Cancellation Policy
                </Link>
              </li>
              <li><Link href="/admin-login" className="hover:text-accent cursor-pointer transition-colors">Admin Area</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-6">Contact</h3>
            <ul className="space-y-4 text-white/60 text-sm">
              <li>
                <strong>Phone:</strong>{' '}
                <a href={phoneHref(s.footer_phone)} className="hover:text-accent">
                  {s.footer_phone}
                </a>
              </li>
              <li>
                <strong>Address:</strong> {s.footer_address}
              </li>
              <li>
                <strong>Email:</strong>{' '}
                <a href={`mailto:${s.footer_email}`} className="break-all hover:text-accent">
                  {s.footer_email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-center text-white/40 text-sm">
          <p>© {new Date().getFullYear()} Aeyyyy Traveller&apos;s Inn. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
