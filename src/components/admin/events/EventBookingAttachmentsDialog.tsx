'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { createClient } from '@/lib/supabase/client';
import { useInvalidateAdmin } from '@/lib/admin/queries';
import { logActivity } from '@/lib/admin/activity-log';
import { uploadToCloudinary } from '@/lib/upload';
import type { EventBooking } from '@/lib/types/event-booking';
import { toast } from 'sonner';

export function EventBookingAttachmentsDialog({
  booking,
  open,
  onOpenChange,
}: {
  booking: EventBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useInvalidateAdmin();
  const [urls, setUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  useEffect(() => {
    if (open) setUrls(booking?.attachment_urls ?? []);
  }, [booking, open]);

  const saveUrls = async (next: string[]) => {
    if (!booking) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('event_bookings')
      .update({ attachment_urls: next })
      .eq('id', booking.id);
    if (error) throw error;
    setUrls(next);
    await invalidate(['eventBookings']);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!booking || !files?.length) return;
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!images.length) {
      toast.error('Choose an image or screenshot');
      return;
    }
    if (urls.length + images.length > 10) {
      toast.error('An event booking can have up to 10 attachments');
      return;
    }

    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const image of images) {
        const asset = await uploadToCloudinary(image, 'aeyyyy/event-booking-attachments');
        uploaded.push(asset.secure_url);
      }
      await saveUrls([...urls, ...uploaded]);
      await logActivity({
        action: 'updated',
        entity: 'event_booking',
        entityId: booking.id,
        summary: `Attached ${uploaded.length} image${uploaded.length === 1 ? '' : 's'} to ${booking.booking_code}`,
      });
      await invalidate(['activity']);
      toast.success('Event booking attachments saved');
    } catch (error) {
      toast.error('Could not save attachments', {
        description:
          error instanceof Error
            ? `${error.message} — run supabase/event-booking-attachments.sql if needed.`
            : undefined,
      });
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async () => {
    if (!booking || !pendingRemove) return;
    try {
      await saveUrls(urls.filter((url) => url !== pendingRemove));
      await logActivity({
        action: 'updated',
        entity: 'event_booking',
        entityId: booking.id,
        summary: `Removed an attachment from ${booking.booking_code}`,
      });
      await invalidate(['activity']);
      toast.success('Attachment removed');
    } catch (error) {
      toast.error('Could not remove attachment', {
        description: error instanceof Error ? error.message : undefined,
      });
      throw error;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !uploading && onOpenChange(next)}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="h-5 w-5 text-violet-600" />
              Event booking attachments
            </DialogTitle>
            <DialogDescription>
              Add screenshots or photos for {booking?.booking_code}. Attachments are admin-only.
            </DialogDescription>
          </DialogHeader>

          <label className="flex cursor-pointer flex-col items-center rounded-[11px] border-2 border-dashed border-violet-200 bg-violet-50/60 px-4 py-6 text-center hover:bg-violet-50 dark:border-violet-900 dark:bg-violet-950/20">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
            ) : (
              <Upload className="h-6 w-6 text-violet-600" />
            )}
            <span className="mt-2 text-sm font-bold text-violet-800 dark:text-violet-200">
              {uploading ? 'Uploading attachments…' : 'Upload screenshots'}
            </span>
            <span className="text-xs text-slate-500">Select up to 10 images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              className="hidden"
              onChange={(event) => {
                const files = event.target.files;
                event.target.value = '';
                void uploadFiles(files);
              }}
            />
          </label>

          {urls.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {urls.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-slate-100 dark:border-slate-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Event attachment ${index + 1}`}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-7 w-7 place-items-center rounded-full bg-white text-slate-700"
                      aria-label={`Open attachment ${index + 1}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setPendingRemove(url)}
                      className="grid h-7 w-7 place-items-center rounded-full bg-rose-600 text-white"
                      aria-label={`Remove attachment ${index + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-[9px] bg-slate-50 px-4 py-5 text-center text-xs text-slate-500 dark:bg-slate-800/50">
              No attachments yet.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={pendingRemove != null}
        onOpenChange={(next) => !next && setPendingRemove(null)}
        title="Remove this attachment?"
        description="The image will be detached from this event booking. Type DELETE to confirm."
        confirmLabel="Remove attachment"
        requireTyping
        typingValue="DELETE"
        onConfirm={removeAttachment}
      />
    </>
  );
}
