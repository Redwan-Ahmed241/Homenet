import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as crypto from 'crypto';
import { CLOUDINARY_TOKEN } from './upload.config.js';
import { LoggerService } from '../logger/logger.service.js';
import { AppException } from '../errors/app.exception.js';
import { PROPERTY_ERRORS } from '../errors/error-codes.js';
import type { IUploadService, UploadResult } from './interfaces/upload.service.interface.js';
import {
  validateFileType,
  validateFileSize,
  resolveResourceType,
  cloudinaryUpload,
} from './upload.utils.js';

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
    const fileName = 'cloudinary.service.ts';
    const functionName = 'uploadFile';

    // 1. Validate mimetype and file size (log warning + throw on failure)
    validateFileType(file.mimetype, allowedMimetypes, this.logger, { fileName, functionName, lineNumber: 28 });
    validateFileSize(file.size, maxSizeMb, this.logger, { fileName, functionName, lineNumber: 37 });

    // 2. Determine resource_type and mapped type
    const { cloudinaryResourceType, mappedResourceType } = resolveResourceType(file.mimetype);

    // 3. Generate publicId — never use original filename
    const publicId = crypto.randomUUID();

    try {
      // 4. Upload to Cloudinary via stream
      const result = await cloudinaryUpload(
        this.cloudinaryClient,
        file.buffer,
        folder,
        publicId,
        cloudinaryResourceType,
      );

      this.logger.info(`Cloudinary upload success: ${publicId}`, {
        fileName,
        functionName,
        lineNumber: 82,
      });

      // 5. Generate thumbnail_url
      const thumbnailUrl = this.getThumbnailUrl(result.secure_url, mappedResourceType as 'image' | 'video');

      return {
        url: result.secure_url,
        public_id: result.public_id,
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
    const fileName = 'cloudinary.service.ts';
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
