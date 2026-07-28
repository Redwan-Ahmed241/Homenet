import { Module, forwardRef } from '@nestjs/common';
import { PropertyController } from './property.controller.js';
import { PropertyService } from './property.service.js';
import { PrismaPropertyRepository } from './repositories/prisma-property.repository.js';
import { UploadModule } from '../../common/upload/upload.module.js';
import { BackgroundTaskModule } from '../../infrastructure/background-task/background-task.module.js';

@Module({
  imports: [UploadModule, forwardRef(() => BackgroundTaskModule)],
  controllers: [PropertyController],
  providers: [
    PropertyService,
    { provide: 'IPropertyRepository', useClass: PrismaPropertyRepository },
  ],
  exports: [PropertyService],
})
export class PropertyModule {}
