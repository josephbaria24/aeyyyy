'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/admin/activity-log';
import { useInvalidateAdmin, useSiteSettings } from '@/lib/admin/queries';
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '@/lib/types/site';
import { toast } from 'sonner';
import { fieldClass, labelClass } from '@/components/admin/content/field';

type FooterFields = Pick<
  SiteSettings,
  | 'footer_blurb'
  | 'footer_phone'
  | 'footer_email'
  | 'footer_address'
  | 'footer_instagram'
  | 'footer_facebook'
  | 'footer_twitter'
  | 'footer_linkedin'
  | 'footer_privacy_url'
  | 'footer_terms_url'
  | 'footer_cancellation_url'
>;

function pickFooter(s: SiteSettings): FooterFields {
  return {
    footer_blurb: s.footer_blurb,
    footer_phone: s.footer_phone,
    footer_email: s.footer_email,
    footer_address: s.footer_address,
    footer_instagram: s.footer_instagram,
    footer_facebook: s.footer_facebook,
    footer_twitter: s.footer_twitter,
    footer_linkedin: s.footer_linkedin,
    footer_privacy_url: s.footer_privacy_url,
    footer_terms_url: s.footer_terms_url,
    footer_cancellation_url: s.footer_cancellation_url,
  };
}

export function FooterTab() {
  const query = useSiteSettings();
  const invalidate = useInvalidateAdmin();
  const [form, setForm] = useState<FooterFields>(pickFooter(DEFAULT_SITE_SETTINGS));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.data) setForm(pickFooter(query.data));
  }, [query.data]);

  const set = (key: keyof FooterFields, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('site_settings').upsert({ id: 'default', ...form });
      if (error) throw error;
      await logActivity({
        action: 'updated',
        entity: 'site',
        entityId: 'default',
        summary: 'Updated footer details',
      });
      await invalidate(['site', 'activity']);
      toast.success('Footer saved');
    } catch (err) {
      toast.error('Could not save footer', {
        description:
          err instanceof Error
            ? `${err.message} — run supabase/site-cms-schema.sql if tables are missing.`
            : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  if (query.isPending && !query.data) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void save(e)} className="rounded-[13px] admin-hairline bg-white p-6 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Footer details</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <textarea
          placeholder="About blurb"
          rows={3}
          value={form.footer_blurb}
          onChange={(e) => set('footer_blurb', e.target.value)}
          className={`${fieldClass} md:col-span-2`}
        />
        <input
          placeholder="Phone"
          value={form.footer_phone}
          onChange={(e) => set('footer_phone', e.target.value)}
          className={fieldClass}
        />
        <input
          placeholder="Email"
          value={form.footer_email}
          onChange={(e) => set('footer_email', e.target.value)}
          className={fieldClass}
        />
        <input
          placeholder="Address"
          value={form.footer_address}
          onChange={(e) => set('footer_address', e.target.value)}
          className={`${fieldClass} md:col-span-2`}
        />
        <div className="md:col-span-2">
          <p className={labelClass}>Social links (leave blank to hide)</p>
        </div>
        <input
          placeholder="Instagram URL"
          value={form.footer_instagram}
          onChange={(e) => set('footer_instagram', e.target.value)}
          className={fieldClass}
        />
        <input
          placeholder="Facebook URL"
          value={form.footer_facebook}
          onChange={(e) => set('footer_facebook', e.target.value)}
          className={fieldClass}
        />
        <input
          placeholder="Twitter / X URL"
          value={form.footer_twitter}
          onChange={(e) => set('footer_twitter', e.target.value)}
          className={fieldClass}
        />
        <input
          placeholder="LinkedIn URL"
          value={form.footer_linkedin}
          onChange={(e) => set('footer_linkedin', e.target.value)}
          className={fieldClass}
        />
        <input
          placeholder="Privacy policy URL"
          value={form.footer_privacy_url}
          onChange={(e) => set('footer_privacy_url', e.target.value)}
          className={fieldClass}
        />
        <input
          placeholder="Terms of service URL"
          value={form.footer_terms_url}
          onChange={(e) => set('footer_terms_url', e.target.value)}
          className={fieldClass}
        />
        <input
          placeholder="Cancellation policy URL"
          value={form.footer_cancellation_url}
          onChange={(e) => set('footer_cancellation_url', e.target.value)}
          className={`${fieldClass} md:col-span-2`}
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-4 inline-flex items-center rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save footer
      </button>
    </form>
  );
}
