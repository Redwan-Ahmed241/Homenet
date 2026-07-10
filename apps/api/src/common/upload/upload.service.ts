import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import { CLOUDINARY_TOKEN } from './upload.config.js';
import { LoggerService } from '../logger/logger.service.js';
import { AppException } from '../errors/app.exception.js';
import { PROPERTY_ERRORS } from '../errors/error-codes.js';
import type { IUploadService, UploadResult } from './interfaces/upload.service.interface.js';

type CloudinaryInstance = typeof cloudinary;

@Injectable()
export class UploadService implements IUploadService {
  constructor(
    @Inject(CLOUDINARY_TOKEN) private readonly cloudinaryClient: CloudinaryInstance,
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    allowedMimetypes: readonly string[],
    maxSizeMb: number,
  ): Promise<UploadResult> {
    const fileName = 'upload.service.ts';
    const functionName = 'uploadFile';

    // 1. Validate mimetype
    if (!allowedMimetypes.includes(file.mimetype)) {
      this.logger.warn(`Invalid file type: ${file.mimetype} — allowed: [${allowedMimetypes.join(', ')}]`, {
        fileName,
        functionName,
        lineNumber: 28,
      });
      throw new AppException(PROPERTY_ERRORS.MEDIA_INVALID_FILE_TYPE);
    }

    // 2. Validate file size
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      this.logger.warn(`File size exceeded: ${file.size} bytes`, {
        fileName,
        functionName,
        lineNumber: 37,
      });
      throw new AppException(PROPERTY_ERRORS.MEDIA_FILE_TOO_LARGE);
    }

    // 3. Determine resource_type and mapped type
    let cloudinaryResourceType: 'image' | 'video' | 'raw';
    let mappedResourceType: 'image' | 'video' | 'document';
    if (file.mimetype.startsWith('image/')) {
      cloudinaryResourceType = 'image';
      mappedResourceType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      cloudinaryResourceType = 'video';
      mappedResourceType = 'video';
    } else {
      cloudinaryResourceType = 'raw';
      mappedResourceType = 'document';
    }

    // 4. Generate publicId — never use original filename
    const publicId = crypto.randomUUID();

    try {
      // 5. Upload to Cloudinary using upload_stream
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = this.cloudinaryClient.uploader.upload_stream(
          {
            folder,
            public_id: publicId,
            resource_type: cloudinaryResourceType,
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

        const readable = Readable.from(file.buffer);
        readable.pipe(uploadStream);
      });

      this.logger.info(`Cloudinary upload success: ${publicId}`, {
        fileName,
        functionName,
        lineNumber: 82,
      });

      // 6. Generate thumbnail_url
      const thumbnailUrl = this.getThumbnailUrl(result.secure_url, mappedResourceType as 'image' | 'video');

      return {
        url: result.secure_url,
        public_id: result.public_id, // Use full Cloudinary public_id (includes folder prefix)
        thumbnail_url: thumbnailUrl,
        resource_type: mappedResourceType,
      };
    } catch (error: any) {
      this.logger.warn(`Cloudinary upload failed: ${error.message}`, {
        fileName,
        functionName,
        lineNumber: 90,
      });
      throw new AppException(PROPERTY_ERRORS.MEDIA_UPLOAD_FAILED);
    }
  }

  async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<void> {
    const fileName = 'upload.service.ts';
    const functionName = 'deleteFile';

    try {
      const options: Record<string, any> = {};
      if (resourceType !== 'image') {
        options.resource_type = resourceType;
      }

      await this.cloudinaryClient.uploader.destroy(publicId, options);

      this.logger.info(`Cloudinary delete success: ${publicId} (type: ${resourceType})`, {
        fileName,
        functionName,
        lineNumber: 107,
      });
    } catch (error: any) {
      // DB row is already deleted — log warning only, do not throw
      this.logger.warn(`Cloudinary delete failed for ${publicId} — manual cleanup needed: ${error.message}`, {
        fileName,
        functionName,
        lineNumber: 113,
      });
    }
  }

  getThumbnailUrl(secureUrl: string, resourceType: 'image' | 'video'): string {
    if (resourceType === 'image') {
      return secureUrl.replace(
        '/upload/',
        '/upload/w_400,h_300,c_fill/',
      );
    }

    if (resourceType === 'video') {
      return secureUrl.replace(
        '/upload/',
        '/upload/w_400,h_300,c_fill,so_0/',
      );
    }

    return secureUrl;
  }
}
