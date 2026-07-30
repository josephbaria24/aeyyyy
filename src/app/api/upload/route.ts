import { NextResponse } from 'next/server';
import { cloudinary, type CloudinaryUploadResult } from '@/lib/cloudinary';

export const runtime = 'nodejs';

function cloudinaryErrorMessage(error: unknown) {
  if (!error) return 'Upload failed';
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const e = error as {
      message?: string;
      error?: { message?: string } | string;
      http_code?: number;
    };
    if (typeof e.error === 'object' && e.error?.message) return e.error.message;
    if (typeof e.error === 'string') return e.error;
    if (e.message) return e.message;
  }
  return 'Upload failed';
}

export async function POST(request: Request) {
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (
      !cloudName ||
      !apiKey ||
      !apiSecret ||
      /your_|example|placeholder/i.test(cloudName) ||
      cloudName.includes('your_cloud')
    ) {
      return NextResponse.json(
        {
          error:
            'Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env.local (from https://console.cloudinary.com), then restart the dev server.',
        },
        { status: 500 },
      );
    }

    // Re-apply config per request so restarted env / trimmed values are used
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    const formData = await request.formData();
    const file = formData.get('file');
    const folder = String(formData.get('folder') || 'aeyyyy');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: 'image',
          },
          (error, uploaded) => {
            if (error || !uploaded) {
              reject(error ?? new Error('Upload failed'));
              return;
            }
            resolve({
              public_id: uploaded.public_id,
              secure_url: uploaded.secure_url,
              width: uploaded.width,
              height: uploaded.height,
              format: uploaded.format,
              bytes: uploaded.bytes,
              resource_type: uploaded.resource_type,
            });
          },
        )
        .end(buffer);
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = cloudinaryErrorMessage(error);
    console.error('[api/upload]', message, error);
    return NextResponse.json(
      {
        error:
          message.includes('cloud_name') || message.includes('Invalid')
            ? `${message}. Check NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME in .env.local (Dashboard → Account Details → Cloud name), then restart npm run dev.`
            : message,
      },
      { status: 500 },
    );
  }
}
