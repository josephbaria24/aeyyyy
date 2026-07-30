'use client';

import { useState } from 'react';
import { Facebook, Link2, Linkedin, Share2 } from 'lucide-react';
import { absoluteShareUrl, shareContent, socialShareLinks } from '@/lib/share';
import type { SiteEvent } from '@/lib/types/content';

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.924L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

export function EventShareButtons({
  event,
  tone = 'dark',
}: {
  event: SiteEvent;
  tone?: 'dark' | 'light';
}) {
  const [note, setNote] = useState('');
  const url = absoluteShareUrl(`/#event-${event.slug}`);
  const payload = {
    title: event.title,
    text: event.subtitle || event.description || event.title,
    url,
  };
  const links = socialShareLinks(payload);
  const btn =
    tone === 'dark'
      ? 'bg-white/15 text-white hover:bg-white/25'
      : 'bg-[#0a1628]/10 text-[#0a1628] hover:bg-[#0a1628]/15';

  const onNative = async () => {
    const result = await shareContent(payload);
    if (result === 'copied') setNote('Link copied');
    window.setTimeout(() => setNote(''), 2500);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setNote('Link copied');
    } catch {
      setNote('Copy failed');
    }
    window.setTimeout(() => setNote(''), 2500);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void onNative()}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition ${btn}`}
        aria-label="Share event"
      >
        <Share2 className="h-3.5 w-3.5" /> Share
      </button>
      <a
        href={links.facebook}
        target="_blank"
        rel="noreferrer"
        className={`rounded-full p-2 transition ${btn}`}
        aria-label="Share on Facebook"
      >
        <Facebook className="h-3.5 w-3.5" />
      </a>
      <a
        href={links.x}
        target="_blank"
        rel="noreferrer"
        className={`rounded-full p-2 transition ${btn}`}
        aria-label="Share on X"
      >
        <XIcon className="h-3.5 w-3.5" />
      </a>
      <a
        href={links.linkedin}
        target="_blank"
        rel="noreferrer"
        className={`rounded-full p-2 transition ${btn}`}
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="h-3.5 w-3.5" />
      </a>
      <button
        type="button"
        onClick={() => void onCopy()}
        className={`rounded-full p-2 transition ${btn}`}
        aria-label="Copy link"
      >
        <Link2 className="h-3.5 w-3.5" />
      </button>
      {note && (
        <span className={`text-[11px] ${tone === 'dark' ? 'text-white/70' : 'text-[#0a1628]/55'}`}>
          {note}
        </span>
      )}
    </div>
  );
}
