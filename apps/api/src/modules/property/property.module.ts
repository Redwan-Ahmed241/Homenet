import { Module } from '@nestjs/common';
import { PropertyController } from './property.controller.js';
import { PropertyService } from './property.service.js';
import { PrismaPropertyRepository } from './repositories/prisma-property.repository.js';
import { UploadModule } from '../../common/upload/upload.module.js';

@Module({
  imports: [UploadModule],
  controllers: [PropertyController],
  providers: [
    PropertyService,
    { provide: 'IPropertyRepository', useClass: PrismaPropertyRepository },
  ],
  exports: [PropertyService],
})
export class PropertyModule {}
