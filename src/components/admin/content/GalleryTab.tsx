'use client';

import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/admin/activity-log';
import { useGallery, useInvalidateAdmin } from '@/lib/admin/queries';
import { uploadToCloudinary } from '@/lib/upload';
import type { SiteGalleryItem } from '@/lib/types/site';
import { toast } from 'sonner';
import { fieldClass } from '@/components/admin/content/field';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';

const empty = { image_url: '', title: '', subtitle: '', sort_order: '0', is_active: true };

export function GalleryTab() {
  const query = useGallery();
  const invalidate = useInvalidateAdmin();
  const items = query.data ?? [];
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SiteGalleryItem | null>(null);

  const upload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadToCloudinary(file, 'aeyyyy/gallery');
      setForm((prev) => ({ ...prev, image_url: uploaded.secure_url }));
      toast.success('Photo uploaded');
    } catch (err) {
      toast.error('Upload failed', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.image_url) {
      toast.error('Upload a photo first');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        image_url: form.image_url,
        title: form.title.trim() || 'Gallery photo',
        subtitle: form.subtitle.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (editingId) {
        const { error } = await supabase.from('site_gallery').update(payload).eq('id', editingId);
        if (error) throw error;
        await logActivity({
          action: 'updated',
          entity: 'gallery',
          entityId: editingId,
          summary: `Updated gallery photo “${payload.title}”`,
        });
      } else {
        const { data, error } = await supabase.from('site_gallery').insert(payload).select('id').single();
        if (error) throw error;
        await logActivity({
          action: 'created',
          entity: 'gallery',
          entityId: data?.id,
          summary: `Added gallery photo “${payload.title}”`,
        });
      }
      setEditingId(null);
      setForm(empty);
      await invalidate(['gallery', 'activity']);
      toast.success(editingId ? 'Photo updated' : 'Photo added');
    } catch (err) {
      toast.error('Could not save photo', {
        description:
          err instanceof Error
            ? `${err.message} — run supabase/site-cms-schema.sql if tables are missing.`
            : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: SiteGalleryItem) => {
    setEditingId(item.id);
    setForm({
      image_url: item.image_url,
      title: item.title,
      subtitle: item.subtitle ?? '',
      sort_order: String(item.sort_order),
      is_active: item.is_active,
    });
  };

  const remove = async (item: SiteGalleryItem) => {
    const supabase = createClient();
    const { error } = await supabase.from('site_gallery').delete().eq('id', item.id);
    if (error) {
      toast.error('Could not delete', { description: error.message });
      return;
    }
    await logActivity({
      action: 'deleted',
      entity: 'gallery',
      entityId: item.id,
      summary: `Deleted gallery photo “${item.title}”`,
    });
    if (editingId === item.id) {
      setEditingId(null);
      setForm(empty);
    }
    await invalidate(['gallery', 'activity']);
    toast.success('Photo removed');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <form
        onSubmit={(e) => void save(e)}
        className="rounded-[13px] admin-hairline bg-white p-4 sm:p-6 dark:bg-slate-900"
      >
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          {editingId ? 'Edit gallery photo' : 'Add gallery photo'}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={fieldClass}
          />
          <input
            placeholder="Subtitle (e.g. Hotel Entrance)"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            className={fieldClass}
          />
          <input
            type="number"
            placeholder="Sort order"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            className={fieldClass}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Show on landing page
          </label>
          <div className="md:col-span-2">
            <input type="file" accept="image/*" onChange={(e) => void upload(e.target.files?.[0] ?? null)} />
            {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
            {form.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt="" className="mt-3 h-36 w-full rounded-[10px] object-cover" />
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={saving || uploading}
            className="inline-flex items-center rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            {editingId ? 'Update photo' : 'Add photo'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(empty);
              }}
              className="rounded-[9px] px-4 py-2.5 text-sm text-slate-500"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
        {query.isPending && !items.length ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : (
          <ul className="divide-y dark:divide-slate-800">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[10px] bg-slate-100 dark:bg-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                      {!item.is_active && <span className="ml-2 text-xs font-medium text-slate-400">Hidden</span>}
                    </p>
                    <p className="text-xs text-slate-500">{item.subtitle || 'No subtitle'}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => startEdit(item)} className="rounded-[5px] bg-slate-100 p-2 dark:bg-slate-800">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(item)}
                    className="rounded-[5px] bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-slate-500">No gallery photos yet.</li>
            )}
          </ul>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this photo?"
        requireTyping
        typingValue="DELETE"
        description={
          pendingDelete
            ? `“${pendingDelete.title || 'Untitled'}” will be removed from the homepage gallery.`
            : ''
        }
        confirmLabel="Delete photo"
        onConfirm={async () => {
          if (pendingDelete) await remove(pendingDelete);
        }}
      />
    </div>
  );
}
