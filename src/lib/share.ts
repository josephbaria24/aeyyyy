export type SharePayload = {
  title: string;
  text?: string;
  url: string;
};

/** Build absolute URL for sharing (browser-safe). */
export function absoluteShareUrl(pathOrHash: string) {
  if (typeof window === 'undefined') return pathOrHash;
  if (pathOrHash.startsWith('http')) return pathOrHash;
  const base = window.location.origin;
  if (pathOrHash.startsWith('#')) return `${base}/${pathOrHash}`;
  if (pathOrHash.startsWith('/')) return `${base}${pathOrHash}`;
  return `${base}/${pathOrHash}`;
}

export function socialShareLinks(payload: SharePayload) {
  const url = encodeURIComponent(payload.url);
  const text = encodeURIComponent(payload.text || payload.title);
  const title = encodeURIComponent(payload.title);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    x: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    mailto: `mailto:?subject=${title}&body=${text}%0A%0A${url}`,
  };
}

/** Prefer native share sheet; fall back to opening a network URL. */
export async function shareContent(
  payload: SharePayload,
  network?: keyof ReturnType<typeof socialShareLinks>,
) {
  const links = socialShareLinks(payload);

  if (!network && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return 'native' as const;
    } catch (err) {
      // User cancelled — ignore
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled' as const;
    }
  }

  if (network) {
    window.open(links[network], '_blank', 'noopener,noreferrer');
    return 'popup' as const;
  }

  try {
    await navigator.clipboard.writeText(payload.url);
    return 'copied' as const;
  } catch {
    return 'failed' as const;
  }
}
