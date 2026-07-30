export type UploadedAsset = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  resource_type?: string;
};

/** Upload a file through our Next.js API (uses Cloudinary API secret on the server). */
export async function uploadToCloudinary(
  file: File,
  folder = 'aeyyyy',
): Promise<UploadedAsset> {
  const body = new FormData();
  body.append('file', file);
  body.append('folder', folder);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }

  return data as UploadedAsset;
}
