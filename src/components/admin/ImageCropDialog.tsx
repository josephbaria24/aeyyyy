'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Loader2, X } from 'lucide-react';
import { getCroppedImageFile } from '@/lib/crop-image';
import { cn } from '@/lib/utils';

export type CropAspectOption = {
  value: number;
  label: string;
};

type ImageCropDialogProps = {
  open: boolean;
  imageSrc: string;
  title?: string;
  aspectOptions?: CropAspectOption[];
  defaultAspect?: number;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

const DEFAULT_ASPECTS: CropAspectOption[] = [
  { value: 16 / 9, label: '16:9 Wide' },
  { value: 4 / 3, label: '4:3 Card' },
  { value: 3 / 1, label: '3:1 Banner' },
  { value: 1, label: '1:1 Square' },
  { value: 21 / 9, label: '21:9 Ultra' },
];

export function ImageCropDialog({
  open,
  imageSrc,
  title = 'Crop & position image',
  aspectOptions = DEFAULT_ASPECTS,
  defaultAspect,
  confirming = false,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(defaultAspect ?? aspectOptions[0]?.value ?? 16 / 9);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState('');

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  if (!open) return null;

  const apply = async () => {
    if (!croppedAreaPixels) return;
    setError('');
    try {
      const file = await getCroppedImageFile(
        imageSrc,
        croppedAreaPixels,
        `crop-${Date.now()}.jpg`,
      );
      await onConfirm(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop image');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close cropper"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onCancel}
        disabled={confirming}
      />

      <div className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-[13px] bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="text-xs text-slate-500">
              Drag to reposition · scroll or use the slider to zoom / resize the crop
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-[7px] p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative h-[min(55vh,420px)] bg-slate-950">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            objectFit="contain"
          />
        </div>

        <div className="space-y-4 border-t border-slate-100 px-4 py-4 dark:border-slate-800">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>Zoom / resize</span>
              <span className="tabular-nums text-slate-400">{zoom.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-slate-900 dark:accent-white"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Aspect ratio
            </p>
            <div className="flex flex-wrap gap-2">
              {aspectOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setAspect(opt.value)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    Math.abs(aspect - opt.value) < 0.001
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              className="rounded-[9px] px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={confirming || !croppedAreaPixels}
              className="inline-flex items-center rounded-[9px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
            >
              {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply crop & upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
