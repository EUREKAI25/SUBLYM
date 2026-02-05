import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

// S3 Client (MinIO compatible)
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET = process.env.S3_BUCKET || 'sublym-assets';
const SIGNED_URL_EXPIRES = 3600; // 1 hour

interface UploadResult {
  key: string;
  width: number;
  height: number;
  hash: string;
}

/**
 * Upload an image to S3/MinIO
 */
export async function uploadToS3(
  buffer: Buffer,
  mimeType: string,
  userId: string,
  kind: string
): Promise<UploadResult> {
  // Process image with sharp
  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Optimize image (convert to webp if not already)
  const optimized = await image
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  // Generate hash for deduplication
  const hash = crypto.createHash('sha256').update(optimized).digest('hex');

  // Generate unique key
  const key = `${kind}/${userId}/${nanoid()}.webp`;

  // Upload to S3
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: optimized,
    ContentType: 'image/webp',
    Metadata: {
      userId,
      kind,
      originalMimeType: mimeType,
      hash,
    },
  }));

  return {
    key,
    width: metadata.width || 0,
    height: metadata.height || 0,
    hash,
  };
}

/**
 * Delete an object from S3/MinIO
 */
export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

/**
 * Get a signed URL for an object
 */
export async function getSignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return s3GetSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_EXPIRES });
}

/**
 * Generate a wallpaper version of an image
 */
export async function generateWallpaper(
  buffer: Buffer,
  userId: string
): Promise<UploadResult> {
  // Create wallpaper with specific dimensions for mobile
  const wallpaper = await sharp(buffer)
    .resize(1170, 2532, { // iPhone 14 Pro dimensions
      fit: 'cover',
      position: 'center',
    })
    .blur(0.5) // Slight blur for background effect
    .webp({ quality: 90 })
    .toBuffer();

  const metadata = await sharp(wallpaper).metadata();
  const hash = crypto.createHash('sha256').update(wallpaper).digest('hex');
  const key = `wallpaper/${userId}/${nanoid()}.webp`;

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: wallpaper,
    ContentType: 'image/webp',
    Metadata: {
      userId,
      kind: 'wallpaper',
      hash,
    },
  }));

  return {
    key,
    width: metadata.width || 1170,
    height: metadata.height || 2532,
    hash,
  };
}
