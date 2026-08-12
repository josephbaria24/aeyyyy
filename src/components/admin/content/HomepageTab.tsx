'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/admin/activity-log';
import { useInvalidateAdmin, useSiteSettings } from '@/lib/admin/queries';
import { uploadToCloudinary } from '@/lib/upload';
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '@/lib/types/site';
import { toast } from 'sonner';
import { fieldClass, labelClass } from '@/components/admin/content/field';

type Form = Omit<SiteSettings, 'id'>;

function toForm(s: SiteSettings): Form {
  const { id: _id, ...rest } = s;
  return rest;
}

export function HomepageTab() {
  const query = useSiteSettings();
  const invalidate = useInvalidateAdmin();
  const [form, setForm] = useState<Form>(toForm(DEFAULT_SITE_SETTINGS));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setForm(toForm(query.data));
  }, [query.data]);

  const set = (key: keyof Form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const upload = async (key: keyof Form, file: File | null, folder: string) => {
    if (!file) return;
    setUploading(key);
    try {
      const uploaded = await uploadToCloudinary(file, folder);
      set(key, uploaded.secure_url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error('Upload failed', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(null);
    }
  };

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
        summary: 'Updated homepage (hero, gallery copy, difference)',
      });
      await invalidate(['site', 'activity']);
      toast.success('Homepage saved');
    } catch (err) {
      toast.error('Could not save homepage', {
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
    <form onSubmit={(e) => void save(e)} className="space-y-6">
      <section className="rounded-[13px] admin-hairline bg-white p-6 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Hero</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Hero background image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void upload('hero_image_url', e.target.files?.[0] ?? null, 'aeyyyy/hero')}
            />
            {uploading === 'hero_image_url' && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
            {form.hero_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.hero_image_url} alt="" className="mt-3 h-40 w-full rounded-[10px] object-cover" />
            )}
          </div>
          <input
            placeholder="Hero title"
            value={form.hero_title}
            onChange={(e) => set('hero_title', e.target.value)}
            className={fieldClass}
          />
          <input
            placeholder="Italic line (e.g. at Aeyyyy Traveller's Inn)"
            value={form.hero_italic}
            onChange={(e) => set('hero_italic', e.target.value)}
            className={fieldClass}
          />
          <textarea
            placeholder="Hero subtitle"
            rows={2}
            value={form.hero_subtitle}
            onChange={(e) => set('hero_subtitle', e.target.value)}
            className={`${fieldClass} md:col-span-2`}
          />
          <input
            placeholder="Address"
            value={form.hero_address}
            onChange={(e) => set('hero_address', e.target.value)}
            className={fieldClass}
          />
          <input
            placeholder="Phone"
            value={form.hero_phone}
            onChange={(e) => set('hero_phone', e.target.value)}
            className={fieldClass}
          />
        </div>
      </section>

      <section className="rounded-[13px] admin-hairline bg-white p-6 dark:bg-slate-900">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Hotel &amp; poolside copy</h2>
        <p className="mb-4 text-xs text-slate-500">Photos for this carousel are under the Gallery tab.</p>
        <div className="grid gap-3">
          <input
            placeholder="Kicker (small label)"
            value={form.gallery_kicker}
            onChange={(e) => set('gallery_kicker', e.target.value)}
            className={fieldClass}
          />
          <input
            placeholder="Section title"
            value={form.gallery_title}
            onChange={(e) => set('gallery_title', e.target.value)}
            className={fieldClass}
          />
          <textarea
            placeholder="Section body"
            rows={3}
            value={form.gallery_body}
            onChange={(e) => set('gallery_body', e.target.value)}
            className={fieldClass}
          />
        </div>
      </section>

      <section className="rounded-[13px] admin-hairline bg-white p-6 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">The difference</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            placeholder="Title"
            value={form.difference_title}
            onChange={(e) => set('difference_title', e.target.value)}
            className={`${fieldClass} md:col-span-2`}
          />
          <textarea
            placeholder="Intro"
            rows={3}
            value={form.difference_body}
            onChange={(e) => set('difference_body', e.target.value)}
            className={`${fieldClass} md:col-span-2`}
          />
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className="grid gap-2 md:col-span-2 md:grid-cols-2">
              <input
                placeholder={`Point ${n} title`}
                value={form[`difference_point_${n}_title`]}
                onChange={(e) => set(`difference_point_${n}_title`, e.target.value)}
                className={fieldClass}
              />
              <input
                placeholder={`Point ${n} details`}
                value={form[`difference_point_${n}_body`]}
                onChange={(e) => set(`difference_point_${n}_body`, e.target.value)}
                className={fieldClass}
              />
            </div>
          ))}
          <div>
            <label className={labelClass}>Top photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                void upload('difference_image_1', e.target.files?.[0] ?? null, 'aeyyyy/homepage')
              }
            />
            {form.difference_image_1 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.difference_image_1} alt="" className="mt-2 h-32 w-full rounded-[10px] object-cover" />
            )}
          </div>
          <div>
            <label className={labelClass}>Bottom photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                void upload('difference_image_2', e.target.files?.[0] ?? null, 'aeyyyy/homepage')
              }
            />
            {form.difference_image_2 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.difference_image_2} alt="" className="mt-2 h-32 w-full rounded-[10px] object-cover" />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[13px] admin-hairline bg-white p-6 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Partners heading</h2>
        <p className="mb-3 text-xs text-slate-500">Add brand logos under the Partners tab.</p>
        <div className="grid gap-3">
          <input
            placeholder="Partners title"
            value={form.partners_title}
            onChange={(e) => set('partners_title', e.target.value)}
            className={fieldClass}
          />
          <input
            placeholder="Partners subtitle"
            value={form.partners_subtitle}
            onChange={(e) => set('partners_subtitle', e.target.value)}
            className={fieldClass}
          />
        </div>
      </section>

      <button
        type="submit"
        disabled={saving || Boolean(uploading)}
        className="inline-flex items-center rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save homepage
      </button>
    </form>
  );
}
