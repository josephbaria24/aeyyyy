import { createBrowserClient } from '@supabase/ssr';

function getSupabaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  // Accept pasted API URLs like ...supabase.co/rest/v1 and normalize to project root
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  const url = getSupabaseUrl();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key || url.includes('your_supabase') || key.includes('your_supabase')) {
    throw new Error(
      'Missing Supabase credentials. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local',
    );
  }

  browserClient = createBrowserClient(url, key);
  return browserClient;
}
