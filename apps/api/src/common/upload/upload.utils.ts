import { Readable } from 'stream';
import type { UploadApiResponse } from 'cloudinary';
import { AppException } from '../errors/app.exception.js';
import { PROPERTY_ERRORS } from '../errors/error-codes.js';
import type { LoggerService } from '../logger/logger.service.js';
import type { LogMetadata } from '../logger/logger.interface.js';

// ── Type helpers ────────────────────────────────────────

type CloudinaryInstance = typeof import('cloudinary').v2;

export type CloudinaryResourceType = 'image' | 'video' | 'raw';
export type MappedResourceType = 'image' | 'video' | 'document';

// ── Validators ──────────────────────────────────────────

/**
 * Validates that the file MIME type is in the allowed list.
 * Logs a warning if a logger is provided, then throws on failure.
 *
 * @throws {AppException} MEDIA_INVALID_FILE_TYPE
 */
export function validateFileType(
  mimetype: string,
  allowedMimetypes: readonly string[],
  logger?: LoggerService,
  logContext?: LogMetadata,
): void {
  if (!allowedMimetypes.includes(mimetype)) {
    if (logger && logContext) {
      logger.warn(
        `Invalid file type: ${mimetype} — allowed: [${allowedMimetypes.join(', ')}]`,
        logContext,
      );
    }
    throw new AppException(PROPERTY_ERRORS.MEDIA_INVALID_FILE_TYPE);
  }
}

/**
 * Validates that the file size does not exceed the specified limit (in MB).
 * Logs a warning if a logger is provided, then throws on failure.
 *
 * @throws {AppException} MEDIA_FILE_TOO_LARGE
 */
export function validateFileSize(
  fileSize: number,
  maxSizeMb: number,
  logger?: LoggerService,
  logContext?: LogMetadata,
): void {
  const maxBytes = maxSizeMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    if (logger && logContext) {
      logger.warn(`File size exceeded: ${fileSize} bytes`, logContext);
    }
    throw new AppException(PROPERTY_ERRORS.MEDIA_FILE_TOO_LARGE);
  }
}

// ── MIME resolvers ──────────────────────────────────────

/**
 * Resolves a MIME type to Cloudinary resource type and a mapped resource type.
 *
 * | MIME prefix   | cloudinaryResourceType | mappedResourceType |
 * |---------------|------------------------|---------------------|
 * | `image/`      | `image`                | `image`             |
 * | `video/`      | `video`                | `video`             |
 * | anything else | `raw`                  | `document`          |
 */
export function resolveResourceType(mimetype: string): {
  cloudinaryResourceType: CloudinaryResourceType;
  mappedResourceType: MappedResourceType;
} {
  if (mimetype.startsWith('image/')) {
    return { cloudinaryResourceType: 'image', mappedResourceType: 'image' };
  }
  if (mimetype.startsWith('video/')) {
    return { cloudinaryResourceType: 'video', mappedResourceType: 'video' };
  }
  return { cloudinaryResourceType: 'raw', mappedResourceType: 'document' };
}

// ── Cloudinary stream upload ────────────────────────────

/**
 * Uploads a file buffer to Cloudinary via `upload_stream`.
 *
 * @returns The Cloudinary upload API response.
 */
export function cloudinaryUpload(
  client: CloudinaryInstance,
  buffer: Buffer,
  folder: string,
  publicId: string,
  resourceType: CloudinaryResourceType,
): Promise<UploadApiResponse> {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
      },
      (error: any, result: UploadApiResponse | undefined) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result);
        } else {
          reject(new Error('Cloudinary upload returned no result'));
        }
      },
    );

    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
  });
}
