'use client';

import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/admin/activity-log';
import { useInvalidateAdmin, useOfferings } from '@/lib/admin/queries';
import { slugifyEventTitle } from '@/lib/types/content';
import { eventAreaImages, type EventOffering } from '@/lib/types/event-offering';
import { uploadToCloudinary } from '@/lib/upload';
import { formatMoney } from '@/lib/money';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';

const empty = {
  title: '',
  description: '',
  notes: '',
  price: '',
  capacity: '',
  sort_order: '0',
  is_active: true,
  availability: 'open' as 'open' | 'unavailable',
  image_urls: [] as string[],
};

const field =
  'w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100';

const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300';

export function AreasTab() {
  const query = useOfferings();
  const invalidate = useInvalidateAdmin();
  const items = query.data ?? [];
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EventOffering | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadToCloudinary(file, 'aeyyyy/event-areas');
        urls.push(uploaded.secure_url);
      }
      setForm((prev) => ({ ...prev, image_urls: [...prev.image_urls, ...urls] }));
      toast.success(urls.length === 1 ? 'Photo added' : `${urls.length} photos added`);
    } catch (err) {
      toast.error('Upload failed', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      toast.error('Area name is required');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        title,
        slug: slugifyEventTitle(title) || `area-${Date.now()}`,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        price: Number(form.price) || 0,
        capacity: Math.max(0, Number(form.capacity) || 0),
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
        availability: form.availability,
        image_urls: form.image_urls,
      };
      if (editingId) {
        const { error } = await supabase.from('event_offerings').update(payload).eq('id', editingId);
        if (error) throw error;
        await logActivity({
          action: 'updated',
          entity: 'offering',
          entityId: editingId,
          summary: `Updated event area “${payload.title}”`,
        });
      } else {
        const { data, error } = await supabase
          .from('event_offerings')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        await logActivity({
          action: 'created',
          entity: 'offering',
          entityId: data?.id,
          summary: `Added event area “${payload.title}”`,
        });
      }
      setEditingId(null);
      setForm(empty);
      await invalidate(['offerings', 'activity']);
      toast.success(editingId ? 'Area updated' : 'Area added');
    } catch (err) {
      toast.error('Could not save area', {
        description:
          err instanceof Error
            ? `${err.message} — run supabase/event-areas-schema.sql if columns are missing.`
            : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: EventOffering) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description ?? '',
      notes: item.notes ?? '',
      price: item.price ? String(item.price) : '',
      capacity: item.capacity ? String(item.capacity) : '',
      sort_order: String(item.sort_order),
      is_active: item.is_active,
      availability: item.availability,
      image_urls: eventAreaImages(item),
    });
  };

  const remove = async (item: EventOffering) => {
    const supabase = createClient();
    const { error } = await supabase.from('event_offerings').delete().eq('id', item.id);
    if (error) {
      toast.error('Could not delete', { description: error.message });
      return;
    }
    await logActivity({
      action: 'deleted',
      entity: 'offering',
      entityId: item.id,
      summary: `Deleted event area “${item.title}”`,
    });
    if (editingId === item.id) {
      setEditingId(null);
      setForm(empty);
    }
    await invalidate(['offerings', 'activity']);
    toast.success('Area removed');
  };

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void save(e)} className="rounded-[13px] admin-hairline bg-white p-6 dark:bg-slate-900">
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">
          {editingId ? 'Edit event area' : 'Add event area'}
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Spaces guests can book (poolside, band area, indoor hall). Photos show on the booking page.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className={labelClass}>Area name</span>
            <input
              required
              placeholder="e.g. Poolside, Band area"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={field}
            />
          </label>
          <label className="md:col-span-2">
            <span className={labelClass}>Description</span>
            <textarea
              placeholder="Shown to guests on the booking page"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={field}
            />
          </label>
          <label className="md:col-span-2">
            <span className={labelClass}>Notes</span>
            <textarea
              placeholder="Inclusions, setup, house rules…"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={field}
            />
          </label>
          <label>
            <span className={labelClass}>Price</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0 = quote later"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={field}
            />
          </label>
          <label>
            <span className={labelClass}>Max guests</span>
            <input
              type="number"
              min={0}
              placeholder="0 = no limit"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              className={field}
            />
          </label>
          <label>
            <span className={labelClass}>Sort order</span>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className={field}
            />
          </label>
          <label>
            <span className={labelClass}>Availability</span>
            <select
              value={form.availability}
              onChange={(e) =>
                setForm({ ...form, availability: e.target.value as 'open' | 'unavailable' })
              }
              className={field}
            >
              <option value="open">Available to book</option>
              <option value="unavailable">Manually unavailable</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Show to guests
          </label>
          <div className="md:col-span-2">
            <p className={labelClass}>Area photos</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void upload(e.target.files)}
            />
            {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
            {form.image_urls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.image_urls.map((url) => (
                  <div key={url} className="relative h-20 w-28 overflow-hidden rounded-[9px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          image_urls: prev.image_urls.filter((u) => u !== url),
                        }))
                      }
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                      aria-label="Remove photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
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
            {editingId ? 'Update area' : 'Add area'}
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
            {items.map((item) => {
              const photos = eventAreaImages(item);
              return (
                <li key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-[10px] bg-slate-100 dark:bg-slate-800">
                      {photos[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photos[0]} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                        <span
                          className={cn(
                            'ml-2 text-xs font-medium',
                            item.availability === 'unavailable'
                              ? 'text-rose-500'
                              : item.is_active
                                ? 'text-emerald-600'
                                : 'text-slate-400',
                          )}
                        >
                          {item.availability === 'unavailable'
                            ? 'Unavailable'
                            : item.is_active
                              ? 'Open'
                              : 'Hidden'}
                        </span>
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.price > 0 ? formatMoney(item.price) : 'Quote later'}
                        {item.capacity > 0 ? ` · up to ${item.capacity} guests` : ''}
                        {photos.length ? ` · ${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''}
                      </p>
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
              );
            })}
            {items.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-slate-500">
                No event areas yet. Add poolside, indoor hall, or other spaces.
              </li>
            )}
          </ul>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this area?"
        requireTyping
        typingValue="DELETE"
        description={
          pendingDelete
            ? `“${pendingDelete.title}” will be removed. Guests will no longer see or book this area.`
            : ''
        }
        confirmLabel="Delete area"
        onConfirm={async () => {
          if (pendingDelete) await remove(pendingDelete);
        }}
      />
    </div>
  );
}
