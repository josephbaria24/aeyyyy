export type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error('Could not load image for cropping')));
    // Needed so canvas export works for Cloudinary / remote URLs
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

/** Prefer a same-origin blob URL so canvas export is not blocked by CORS. */
export async function prepareCropSource(src: string): Promise<string> {
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error('Could not fetch image for cropping');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Render the cropped region to a JPEG/PNG File for upload. */
export async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName = 'cropped.jpg',
  mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.92,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const width = Math.max(1, Math.round(pixelCrop.width));
  const height = Math.max(1, Math.round(pixelCrop.height));
  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Crop export failed'))),
      mimeType,
      quality,
    );
  });

  return new File([blob], fileName, { type: mimeType });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(new Error('Could not read file')));
    reader.readAsDataURL(file);
  });
}
