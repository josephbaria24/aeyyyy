'use client';

import { useState } from 'react';
import { Crop, Loader2, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  useEvents,
  useInvalidateAdmin,
  useRules,
} from '@/lib/admin/queries';
import { uploadToCloudinary } from '@/lib/upload';
import { prepareCropSource, readFileAsDataUrl } from '@/lib/crop-image';
import {
  EVENT_LAYOUTS,
  slugifyEventTitle,
  type EventLayout,
  type SiteEvent,
  type SiteRule,
} from '@/lib/types/content';
import { absoluteShareUrl, shareContent } from '@/lib/share';
import { cn } from '@/lib/utils';
import { EventLandingPreview } from '@/components/admin/EventLandingPreview';
import { ImageCropDialog } from '@/components/admin/ImageCropDialog';
import { toast } from 'sonner';

type Tab = 'rules' | 'events';

const emptyRule = { title: '', body: '', sort_order: '0', is_active: true };
const emptyEvent = {
  title: '',
  subtitle: '',
  description: '',
  image_url: '',
  event_date: '',
  location: '',
  layout: 'card' as EventLayout,
  sort_order: '0',
  is_active: true,
};

function layoutCropAspect(layout: EventLayout) {
  if (layout === 'featured') return 16 / 9;
  if (layout === 'wide') return 3 / 1;
  return 4 / 3;
}

export default function AdminContentPage() {
  const [tab, setTab] = useState<Tab>('rules');
  const rulesQuery = useRules();
  const eventsQuery = useEvents();
  const invalidate = useInvalidateAdmin();
  const rules = rulesQuery.data ?? [];
  const events = eventsQuery.data ?? [];

  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const payload = {
        title: ruleForm.title.trim(),
        body: ruleForm.body.trim(),
        sort_order: Number(ruleForm.sort_order) || 0,
        is_active: ruleForm.is_active,
      };
      if (!payload.title || !payload.body) throw new Error('Title and body are required');

      if (editingRuleId) {
        const { error: err } = await supabase.from('site_rules').update(payload).eq('id', editingRuleId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('site_rules').insert(payload);
        if (err) throw err;
      }
      setEditingRuleId(null);
      setRuleForm(emptyRule);
      await invalidate(['rules']);
      toast.success(editingRuleId ? 'Rule updated' : 'Rule added');
    } catch (err) {
      const message =
        err instanceof Error
          ? `${err.message} — run supabase/content-schema.sql if tables are missing.`
          : 'Could not save rule';
      setError(message);
      toast.error('Could not save rule', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const startEditRule = (rule: SiteRule) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      title: rule.title,
      body: rule.body,
      sort_order: String(rule.sort_order),
      is_active: rule.is_active,
    });
  };

  const deleteRule = async (id: string) => {
    if (!window.confirm('Delete this rule?')) return;
    const supabase = createClient();
    const { error: err } = await supabase.from('site_rules').delete().eq('id', id);
    if (err) {
      toast.error('Could not delete rule', { description: err.message });
      return;
    }
    if (editingRuleId === id) {
      setEditingRuleId(null);
      setRuleForm(emptyRule);
    }
    await invalidate(['rules']);
    toast.success('Rule deleted');
  };

  const openCropFromFile = async (file: File | null) => {
    if (!file) return;
    setError('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCropSrc(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read image');
      toast.error('Could not read image');
    } finally {
      setFileInputKey((k) => k + 1);
    }
  };

  const uploadCroppedEventImage = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const uploaded = await uploadToCloudinary(file, 'aeyyyy/events');
      setEventForm((prev) => ({ ...prev, image_url: uploaded.secure_url }));
      setCropSrc(null);
      toast.success('Event image uploaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image upload failed';
      setError(message);
      toast.error('Image upload failed', { description: message });
    } finally {
      setUploading(false);
    }
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const payload = {
        title: eventForm.title.trim(),
        slug: slugifyEventTitle(eventForm.title),
        subtitle: eventForm.subtitle.trim() || null,
        description: eventForm.description.trim() || null,
        image_url: eventForm.image_url || null,
        event_date: eventForm.event_date || null,
        location: eventForm.location.trim() || null,
        layout: eventForm.layout,
        sort_order: Number(eventForm.sort_order) || 0,
        is_active: eventForm.is_active,
      };
      if (!payload.title || !payload.slug) throw new Error('Event title is required');

      if (editingEventId) {
        const { error: err } = await supabase.from('events').update(payload).eq('id', editingEventId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('events').insert(payload);
        if (err) throw err;
      }
      setEditingEventId(null);
      setEventForm(emptyEvent);
      await invalidate(['events']);
      toast.success(editingEventId ? 'Event updated' : 'Event added');
    } catch (err) {
      const message =
        err instanceof Error
          ? `${err.message} — run supabase/content-schema.sql if tables are missing.`
          : 'Could not save event';
      setError(message);
      toast.error('Could not save event', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const startEditEvent = (event: SiteEvent) => {
    setEditingEventId(event.id);
    setEventForm({
      title: event.title,
      subtitle: event.subtitle ?? '',
      description: event.description ?? '',
      image_url: event.image_url ?? '',
      event_date: event.event_date ?? '',
      location: event.location ?? '',
      layout: event.layout,
      sort_order: String(event.sort_order),
      is_active: event.is_active,
    });
  };

  const deleteEvent = async (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    const supabase = createClient();
    const { error: err } = await supabase.from('events').delete().eq('id', id);
    if (err) {
      toast.error('Could not delete event', { description: err.message });
      return;
    }
    if (editingEventId === id) {
      setEditingEventId(null);
      setEventForm(emptyEvent);
    }
    await invalidate(['events']);
    toast.success('Event deleted');
  };

  const shareEvent = async (event: SiteEvent) => {
    const url = absoluteShareUrl(`/#event-${event.slug}`);
    const result = await shareContent({
      title: event.title,
      text: event.subtitle || event.description || `Join us: ${event.title}`,
      url,
    });
    if (result === 'copied') {
      setShareNote('Link copied to clipboard');
      toast.success('Link copied');
    } else if (result === 'native' || result === 'popup') {
      setShareNote('Share opened');
      toast.info('Share opened');
    } else if (result === 'cancelled') {
      setShareNote('');
    } else {
      setShareNote('Could not share — copy this URL: ' + url);
      toast.error('Could not share');
    }
    window.setTimeout(() => setShareNote(''), 3500);
  };

  return (
    <>
      {error && (
        <div className="mb-4 rounded-[13px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}
      {shareNote && (
        <div className="mb-4 rounded-[13px] admin-hairline bg-white px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {shareNote}
        </div>
      )}

      <div className="mb-6 flex gap-2">
        {(
          [
            ['rules', 'Rules & Regulations'],
            ['events', 'Events'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-[9px] px-4 py-2 text-sm font-semibold transition',
              tab === id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-600 admin-hairline hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <div className="space-y-6">
          <form onSubmit={saveRule} className="rounded-[13px] admin-hairline bg-white p-6 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
              {editingRuleId ? 'Edit rule' : 'Add rule'}
            </h2>
            <div className="space-y-3">
              <input
                required
                placeholder="Title (e.g. Check-in time)"
                value={ruleForm.title}
                onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100"
              />
              <textarea
                required
                placeholder="Rule details"
                rows={3}
                value={ruleForm.body}
                onChange={(e) => setRuleForm({ ...ruleForm, body: e.target.value })}
                className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex flex-wrap gap-3">
                <input
                  type="number"
                  placeholder="Sort order"
                  value={ruleForm.sort_order}
                  onChange={(e) => setRuleForm({ ...ruleForm, sort_order: e.target.value })}
                  className="w-36 rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100"
                />
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={ruleForm.is_active}
                    onChange={(e) => setRuleForm({ ...ruleForm, is_active: e.target.checked })}
                  />
                  Show on landing page
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  {editingRuleId ? 'Update rule' : 'Add rule'}
                </button>
                {editingRuleId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRuleId(null);
                      setRuleForm(emptyRule);
                    }}
                    className="rounded-[9px] px-4 py-2.5 text-sm text-slate-500"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
            {rulesQuery.isPending && !rules.length ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            ) : (
              <ul className="divide-y dark:divide-slate-800">
                {rules.map((rule) => (
                  <li key={rule.id} className="flex items-start justify-between gap-4 px-4 py-4">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {rule.title}
                        {!rule.is_active && (
                          <span className="ml-2 text-xs font-medium text-slate-400">Hidden</span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{rule.body}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => startEditRule(rule)} className="rounded-[5px] bg-slate-100 p-2 dark:bg-slate-800">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => void deleteRule(rule.id)} className="rounded-[5px] bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
                {rules.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-slate-500">No rules yet.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <form onSubmit={saveEvent} className="rounded-[13px] admin-hairline bg-white p-6 dark:bg-slate-900">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingEventId ? 'Edit event' : 'Add event'}
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  required
                  placeholder="Event title"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100"
                />
                <input
                  placeholder="Subtitle"
                  value={eventForm.subtitle}
                  onChange={(e) => setEventForm({ ...eventForm, subtitle: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100"
                />
                <input
                  type="date"
                  value={eventForm.event_date}
                  onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100"
                />
                <input
                  placeholder="Location"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="md:col-span-2">
                  <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Layout on landing page
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {EVENT_LAYOUTS.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => setEventForm({ ...eventForm, layout: l.value })}
                        className={cn(
                          'rounded-[9px] px-3 py-2.5 text-left transition',
                          eventForm.layout === l.value
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'admin-hairline bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-300',
                        )}
                      >
                        <span className="block text-sm font-semibold">{l.label}</span>
                        <span
                          className={cn(
                            'mt-0.5 block text-[11px]',
                            eventForm.layout === l.value
                              ? 'text-white/70 dark:text-slate-500'
                              : 'text-slate-400',
                          )}
                        >
                          {l.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  placeholder="Sort order"
                  value={eventForm.sort_order}
                  onChange={(e) => setEventForm({ ...eventForm, sort_order: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm dark:bg-slate-950 dark:text-slate-100"
                />
                <textarea
                  placeholder="Description"
                  rows={3}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full rounded-[9px] admin-hairline px-3 py-2.5 text-sm md:col-span-2 dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">
                    Event image — crop & position before upload
                  </label>
                  <input
                    key={fileInputKey}
                    type="file"
                    accept="image/*"
                    onChange={(e) => void openCropFromFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm"
                  />
                  {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
                  {eventForm.image_url && (
                    <div className="mt-3 space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={eventForm.image_url}
                        alt=""
                        className="h-36 w-full rounded-[10px] object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            try {
                              setCropSrc(await prepareCropSource(eventForm.image_url));
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : 'Could not open image for recrop',
                              );
                            }
                          })();
                        }}
                        disabled={uploading}
                        className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Crop className="h-3.5 w-3.5" />
                        Recrop / reposition
                      </button>
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={eventForm.is_active}
                    onChange={(e) => setEventForm({ ...eventForm, is_active: e.target.checked })}
                  />
                  Show on landing page
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="inline-flex items-center rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  {editingEventId ? 'Update event' : 'Add event'}
                </button>
                {editingEventId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEventId(null);
                      setEventForm(emptyEvent);
                    }}
                    className="rounded-[9px] px-4 py-2.5 text-sm text-slate-500"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <EventLandingPreview form={eventForm} />
          </div>

          <div className="overflow-hidden rounded-[13px] admin-hairline bg-white dark:bg-slate-900">
            {eventsQuery.isPending && !events.length ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            ) : (
              <ul className="divide-y dark:divide-slate-800">
                {events.map((event) => (
                  <li key={event.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[10px] bg-slate-100 dark:bg-slate-800">
                        {event.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={event.image_url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {event.title}
                          <span className="ml-2 text-xs font-medium capitalize text-slate-400">
                            {event.layout}
                            {!event.is_active ? ' · Hidden' : ''}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {[event.event_date, event.location].filter(Boolean).join(' · ') || 'No date set'}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void shareEvent(event)}
                        className="inline-flex items-center rounded-[5px] bg-slate-100 px-3 py-1.5 text-xs font-medium dark:bg-slate-800"
                      >
                        <Share2 className="mr-1 h-3.5 w-3.5" /> Share
                      </button>
                      <button type="button" onClick={() => startEditEvent(event)} className="rounded-[5px] bg-slate-100 p-2 dark:bg-slate-800">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => void deleteEvent(event.id)} className="rounded-[5px] bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
                {events.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-slate-500">No events yet.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
      {cropSrc && (
        <ImageCropDialog
          key={cropSrc}
          open
          imageSrc={cropSrc}
          title="Crop & position event image"
          defaultAspect={layoutCropAspect(eventForm.layout)}
          confirming={uploading}
          onCancel={() => {
            if (!uploading) setCropSrc(null);
          }}
          onConfirm={uploadCroppedEventImage}
        />
      )}
    </>
  );
}
