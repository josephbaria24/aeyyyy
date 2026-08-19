'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useBookings, useInvalidateAdmin, useRooms } from '@/lib/admin/queries';
import { formatMoney, SYSTEM_CURRENCY, SYSTEM_CURRENCY_LABEL, SYSTEM_CURRENCY_SYMBOL } from '@/lib/money';
import { uploadToCloudinary } from '@/lib/upload';
import { slugifyRoomName, ROOM_CATEGORIES, ROOM_AMENITIES, roomImages, type Room } from '@/lib/types/room';
import {
  getRoomStatusForDate,
  ROOM_LIVE_STATUS_LABEL,
  type RoomLiveStatus,
} from '@/lib/room-status';
import { AdminIcon, adminIcons } from '@/components/admin/AdminIcon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logActivity } from '@/lib/admin/activity-log';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';

const emptyForm = {
  name: '',
  category: 'Standard',
  description: '',
  amenities: [] as string[],
  price_per_night: '',
  capacity: '2',
  sort_order: '0',
  image_urls: [] as string[],
  is_active: true,
};

const TODAY_STATUS_STYLES: Record<RoomLiveStatus, string> = {
  available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  reserved: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
  occupied: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  unavailable: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const fieldClass =
  'w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100';

function FieldLabel({
  icon,
  htmlFor,
  children,
}: {
  icon: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
    >
      <AdminIcon icon={icon} width={15} height={15} className="text-slate-400" />
      {children}
    </label>
  );
}

export function RoomsTab() {
  const roomsQuery = useRooms();
  const bookingsQuery = useBookings();
  const invalidate = useInvalidateAdmin();
  const rooms = roomsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const isPending = roomsQuery.isPending && !roomsQuery.data;

  const todayStatusByRoom = useMemo(() => {
    const map = new Map<string, RoomLiveStatus>();
    for (const room of rooms) {
      map.set(room.id, getRoomStatusForDate(room, bookings).status);
    }
    return map;
  }, [rooms, bookings]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [customAmenity, setCustomAmenity] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Room | null>(null);

  const presetLabels = new Set<string>(ROOM_AMENITIES.map((a) => a.label));
  const customSelected = form.amenities.filter((a) => !presetLabels.has(a));

  const startEdit = (room: Room) => {
    setEditingId(room.id);
    setCustomAmenity('');
    setForm({
      name: room.name,
      category: room.category || 'Standard',
      description: room.description ?? '',
      amenities: room.amenities ?? [],
      price_per_night: String(room.price_per_night ?? 0),
      capacity: String(room.capacity ?? 2),
      sort_order: String(room.sort_order ?? 0),
      image_urls: roomImages(room),
      is_active: room.is_active,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCustomAmenity('');
  };

  const onImagesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadToCloudinary(file, 'aeyyyy/rooms');
        uploadedUrls.push(uploaded.secure_url);
      }
      setForm((prev) => ({
        ...prev,
        image_urls: [...prev.image_urls, ...uploadedUrls],
      }));
      toast.success(
        uploadedUrls.length === 1
          ? 'Image uploaded'
          : `${uploadedUrls.length} images uploaded`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image upload failed';
      setError(message);
      toast.error('Image upload failed', { description: message });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => {
    setForm((prev) => ({
      ...prev,
      image_urls: prev.image_urls.filter((u) => u !== url),
    }));
  };

  const moveImage = (url: string, dir: -1 | 1) => {
    setForm((prev) => {
      const list = [...prev.image_urls];
      const i = list.indexOf(url);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= list.length) return prev;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...prev, image_urls: list };
    });
  };

  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const payload = {
        name: form.name.trim(),
        slug: slugifyRoomName(form.name),
        category: form.category.trim() || 'Standard',
        description: form.description.trim() || null,
        amenities: form.amenities,
        price_per_night: Number(form.price_per_night) || 0,
        currency: SYSTEM_CURRENCY,
        capacity: Math.max(1, Number(form.capacity) || 1),
        sort_order: Number(form.sort_order) || 0,
        image_urls: form.image_urls,
        image_url: form.image_urls[0] || null,
        is_active: form.is_active,
      };

      if (!payload.name) throw new Error('Room name is required');
      if (!payload.slug) throw new Error('Could not generate a valid slug from the name');

      if (editingId) {
        const { error: updateError } = await supabase
          .from('rooms')
          .update(payload)
          .eq('id', editingId);
        if (updateError) throw updateError;
        await logActivity({
          action: 'updated',
          entity: 'room',
          entityId: editingId,
          summary: `Updated room “${payload.name}”`,
        });
      } else {
        const { data, error: insertError } = await supabase
          .from('rooms')
          .insert(payload)
          .select('id')
          .single();
        if (insertError) throw insertError;
        await logActivity({
          action: 'created',
          entity: 'room',
          entityId: data?.id,
          summary: `Added room “${payload.name}”`,
        });
      }

      resetForm();
      await invalidate(['rooms', 'activity']);
      toast.success(editingId ? 'Room updated' : 'Room added');
    } catch (err) {
      const raw =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message || '')
          : err instanceof Error
            ? err.message
            : '';
      const missingColumn = /column .* does not exist/i.test(raw);
      const message = missingColumn
        ? `${raw} — run supabase/rooms-migrate-columns.sql in the Supabase SQL Editor, then try again.`
        : raw || 'Could not save room';
      setError(message);
      toast.error('Could not save room', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const toggleAmenity = (label: string) => {
    setForm((prev) => {
      const selected = prev.amenities.includes(label)
        ? prev.amenities.filter((a) => a !== label)
        : [...prev.amenities, label];
      return { ...prev, amenities: selected };
    });
  };

  const addCustomAmenity = () => {
    const label = customAmenity.trim();
    if (!label) return;
    setForm((prev) => {
      if (prev.amenities.some((a) => a.toLowerCase() === label.toLowerCase())) {
        return prev;
      }
      return { ...prev, amenities: [...prev.amenities, label] };
    });
    setCustomAmenity('');
  };

  const toggleActive = async (room: Room) => {
    setError('');
    try {
      const supabase = createClient();
      const next = !room.is_active;
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ is_active: next })
        .eq('id', room.id);
      if (updateError) throw updateError;
      await logActivity({
        action: next ? 'published' : 'hidden',
        entity: 'room',
        entityId: room.id,
        summary: `${next ? 'Published' : 'Hid'} room “${room.name}”`,
      });
      await invalidate(['rooms', 'activity']);
      toast.success(next ? 'Room published' : 'Room hidden', {
        description: room.name,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update room';
      setError(message);
      toast.error('Could not update room', { description: message });
    }
  };

  const deleteRoom = async (id: string) => {
    setError('');
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from('rooms').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await logActivity({
        action: 'deleted',
        entity: 'room',
        entityId: id,
        summary: 'Deleted a room',
      });
      if (editingId === id) resetForm();
      await invalidate(['rooms', 'activity']);
      toast.success('Room deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete room';
      setError(message);
      toast.error('Could not delete room', { description: message });
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 rounded-[13px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.35fr)] xl:items-start">
        {/* Left: room list */}
        <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900 xl:sticky xl:top-0 xl:max-h-[calc(100dvh-10rem)] xl:flex xl:flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-[#0a1628] dark:text-slate-100">Rooms</h2>
            <span className="text-xs text-slate-400">{rooms.length} total</span>
          </div>

          {isPending ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#0a1628] dark:text-slate-100" />
            </div>
          ) : (
            <div className="overflow-y-auto">
              {rooms.map((room) => {
                const photos = roomImages(room);
                const selected = editingId === room.id;
                const live = todayStatusByRoom.get(room.id) ?? 'available';
                return (
                  <div
                    key={room.id}
                    className={cn(
                      'flex gap-3 border-b border-slate-50 px-3 py-3 dark:border-slate-800',
                      selected && 'bg-slate-50 dark:bg-slate-800/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => startEdit(room)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-[6px] bg-slate-100 dark:bg-slate-800">
                        {photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photos[0]}
                            alt={room.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        {photos.length > 1 && (
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-semibold text-white">
                            +{photos.length - 1}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0a1628] dark:text-slate-100">
                          {room.name}
                        </p>
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {room.category || 'Standard'} · {formatMoney(room.price_per_night)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                              TODAY_STATUS_STYLES[live],
                            )}
                          >
                            {ROOM_LIVE_STATUS_LABEL[live]}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {room.is_active ? 'Published' : 'Hidden'}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => void toggleActive(room)}
                        className={cn(
                          'rounded-[5px] px-2 py-1 text-[10px] font-semibold',
                          room.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                        )}
                      >
                        {room.is_active ? 'On' : 'Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(room)}
                        className="rounded-[5px] bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(room)}
                        className="rounded-[5px] bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                );
              })}
              {rooms.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  No rooms yet. Use the form to add one.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: form */}
        <form
          onSubmit={saveRoom}
          className="rounded-[13px] admin-hairline bg-white p-5 dark:bg-slate-900 xl:max-h-[calc(100dvh-10rem)] xl:overflow-y-auto"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#0a1628] dark:text-slate-100">
              {editingId ? 'Edit room' : 'Add room'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel icon={adminIcons.roomName} htmlFor="room-name">
                Room name
              </FieldLabel>
              <input
                id="room-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <FieldLabel icon={adminIcons.category} htmlFor="room-category">
                Category
              </FieldLabel>
              <select
                id="room-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={fieldClass}
              >
                {ROOM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel icon={adminIcons.price} htmlFor="room-price">
                Price / night ({SYSTEM_CURRENCY_LABEL})
              </FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                  {SYSTEM_CURRENCY_SYMBOL}
                </span>
                <input
                  id="room-price"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_per_night}
                  onChange={(e) => setForm({ ...form, price_per_night: e.target.value })}
                  className={`${fieldClass} pl-8`}
                />
              </div>
            </div>

            <div>
              <FieldLabel icon={adminIcons.capacity} htmlFor="room-capacity">
                Capacity (guests)
              </FieldLabel>
              <input
                id="room-capacity"
                required
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <FieldLabel icon={adminIcons.sort} htmlFor="room-sort">
                Sort order
              </FieldLabel>
              <input
                id="room-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel icon={adminIcons.description} htmlFor="room-description">
                Description
              </FieldLabel>
              <textarea
                id="room-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={fieldClass}
                rows={2}
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel icon={adminIcons.amenities}>
                Amenities
                {form.amenities.length > 0 && (
                  <span className="ml-1 font-medium text-slate-400">
                    · {form.amenities.length} selected
                  </span>
                )}
              </FieldLabel>
              <div className="max-h-36 overflow-y-auto rounded-[9px] admin-hairline bg-slate-50/80 p-2 dark:bg-slate-950/50">
                <div className="flex flex-wrap gap-1.5">
                  {ROOM_AMENITIES.map((item) => {
                    const active = form.amenities.includes(item.label);
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => toggleAmenity(item.label)}
                        aria-pressed={active}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                          active
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300',
                        )}
                      >
                        <AdminIcon
                          icon={item.icon}
                          width={13}
                          height={13}
                          className={active ? 'text-white dark:text-slate-900' : 'text-slate-400'}
                        />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {customSelected.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {customSelected.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleAmenity(label)}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900"
                      title="Remove"
                    >
                      {label}
                      <span className="opacity-70">×</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <input
                  id="room-amenities-custom"
                  value={customAmenity}
                  onChange={(e) => setCustomAmenity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomAmenity();
                    }
                  }}
                  placeholder="Custom amenity"
                  className={fieldClass}
                />
                <button
                  type="button"
                  onClick={addCustomAmenity}
                  disabled={!customAmenity.trim()}
                  className="shrink-0 rounded-[9px] bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel icon={adminIcons.photo} htmlFor="room-photo">
                Room photos
                {form.image_urls.length > 0 && (
                  <span className="ml-1 font-medium text-slate-400">
                    · {form.image_urls.length}
                  </span>
                )}
              </FieldLabel>
              <input
                id="room-photo"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  void onImagesSelected(e.target.files);
                  e.target.value = '';
                }}
                className="w-full text-sm file:mr-3 file:rounded-[7px] file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-200"
              />
              {uploading && <p className="mt-1 text-xs text-gray-500">Uploading…</p>}
              {form.image_urls.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {form.image_urls.map((url, i) => (
                    <div
                      key={url}
                      className="relative h-20 w-28 shrink-0 overflow-hidden rounded-[8px] admin-hairline"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Room photo ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          Cover
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 px-1 py-0.5">
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveImage(url, -1)}
                            disabled={i === 0}
                            className="text-[10px] font-semibold text-white disabled:opacity-30"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => moveImage(url, 1)}
                            disabled={i === form.image_urls.length - 1}
                            className="text-[10px] font-semibold text-white disabled:opacity-30"
                          >
                            →
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="text-[10px] font-semibold text-rose-200"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-slate-300"
              />
              Visible on public Rooms page
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="mt-4 inline-flex items-center rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            {editingId ? 'Update room' : 'Add room'}
          </button>
        </form>
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this room?"
        requireTyping
        typingValue="DELETE"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” will be permanently deleted. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete room"
        onConfirm={async () => {
          if (pendingDelete) await deleteRoom(pendingDelete.id);
        }}
      />
    </>
  );
}
