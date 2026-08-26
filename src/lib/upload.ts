export type UploadedAsset = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  resource_type?: string;
};

/** Hosts (Vercel/nginx) often reject bodies over ~4.5MB with plain text, not JSON. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1920;
const JPEG_QUALITY = 0.82;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image for compression'));
    };
    img.src = url;
  });
}

/** Shrink oversized photos so they fit hosting body limits before hitting /api/upload. */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }
  // Already small enough — skip work
  if (file.size <= MAX_UPLOAD_BYTES * 0.85) {
    return file;
  }

  try {
    const image = await loadImageFromFile(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(image, 0, 0, width, height);

    let quality = JPEG_QUALITY;
    let blob: Blob | null = null;
    for (let i = 0; i < 4; i++) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
      });
      if (!blob) break;
      if (blob.size <= MAX_UPLOAD_BYTES) break;
      quality -= 0.12;
    }

    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function friendlyUploadError(status: number, raw: string, parsed?: { error?: string }) {
  if (parsed?.error) return parsed.error;

  const text = raw.trim();
  if (
    status === 413 ||
    /request entity too large/i.test(text) ||
    /^request en/i.test(text)
  ) {
    return 'Image is too large for upload. Try a smaller photo (under 4 MB) or a compressed JPEG.';
  }
  if (status === 401 || status === 403) {
    return 'You must be signed in as admin to upload images.';
  }
  if (text) {
    // Avoid dumping HTML error pages into the toast
    if (text.startsWith('<') || text.length > 180) {
      return `Upload failed (HTTP ${status}). The file may be too large or the server rejected it.`;
    }
    return text;
  }
  return `Upload failed (HTTP ${status})`;
}

async function readResponsePayload(res: Response): Promise<{ raw: string; json?: { error?: string } & UploadedAsset }> {
  const raw = await res.text();
  if (!raw) return { raw: '' };
  try {
    return { raw, json: JSON.parse(raw) as { error?: string } & UploadedAsset };
  } catch {
    return { raw };
  }
}

/** Upload a file through our Next.js API (uses Cloudinary API secret on the server). */
export async function uploadToCloudinary(
  file: File,
  folder = 'aeyyyy',
): Promise<UploadedAsset> {
  const prepared = await compressImageIfNeeded(file);

  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File is still too large after compression (${(prepared.size / (1024 * 1024)).toFixed(1)} MB). Use an image under 4 MB.`,
    );
  }

  const body = new FormData();
  body.append('file', prepared);
  body.append('folder', folder);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body,
  });

  const { raw, json } = await readResponsePayload(res);
  if (!res.ok) {
    throw new Error(friendlyUploadError(res.status, raw, json));
  }
  if (!json?.secure_url) {
    throw new Error('Upload succeeded but no image URL was returned.');
  }

  return json;
}
