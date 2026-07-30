import Link from 'next/link';
import { Instagram, Facebook, Twitter, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative bg-[#060d1a] text-white py-20 overflow-hidden">
      {/* Watermark Logo */}
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
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Comfortable rooms, a refreshing outdoor pool, and warm hospitality for families, friends, and travelers.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-accent transition-colors duration-300">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-accent transition-colors duration-300">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-accent transition-colors duration-300">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-accent transition-colors duration-300">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-4 text-white/60 text-sm">
              <li><Link href="/" className="hover:text-accent cursor-pointer transition-colors">Our Story</Link></li>
              <li><Link href="/rooms" className="hover:text-accent cursor-pointer transition-colors">Rooms</Link></li>
              <li><Link href="/" className="hover:text-accent cursor-pointer transition-colors">Experiences</Link></li>
              <li><Link href="/book" className="hover:text-accent cursor-pointer transition-colors">Book Now</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-6">Terms</h3>
            <ul className="space-y-4 text-white/60 text-sm">
              <li><Link href="/" className="hover:text-accent cursor-pointer transition-colors">Privacy Policy</Link></li>
              <li><Link href="/" className="hover:text-accent cursor-pointer transition-colors">Terms of Service</Link></li>
              <li><Link href="/" className="hover:text-accent cursor-pointer transition-colors">Cancellation Policy</Link></li>
              <li><Link href="/admin-login" className="hover:text-accent cursor-pointer transition-colors">Admin Area</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-6">Contact</h3>
            <ul className="space-y-4 text-white/60 text-sm">
              <li><strong>India:</strong> +91 98765 43210</li>
              <li><strong>Costa Rica:</strong> +506 8765 4321</li>
              <li><strong>Email:</strong> reservations@aeyyyytravellersinn.com</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-center text-white/40 text-sm">
          <p>© {new Date().getFullYear()} Aeyyyy Traveller's Inn. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
