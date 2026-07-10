import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadConfig, CLOUDINARY_TOKEN } from './upload.config.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CLOUDINARY_TOKEN,
      useFactory: (uploadConfig: UploadConfig) => uploadConfig.createCloudinary(),
      inject: [UploadConfig],
    },
    UploadConfig,
    UploadService,
    { provide: 'IUploadService', useClass: UploadService },
  ],
  exports: [UploadService, CLOUDINARY_TOKEN, 'IUploadService'],
})
export class UploadModule {}
