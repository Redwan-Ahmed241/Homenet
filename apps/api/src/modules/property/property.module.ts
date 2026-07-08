import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PropertyController } from './property.controller.js';
import { PropertyService } from './property.service.js';
import { PrismaPropertyRepository } from './repositories/prisma-property.repository.js';

@Module({
  imports: [
    CacheModule.register(),
  ],
  controllers: [PropertyController],
  providers: [
    PropertyService,
    { provide: 'IPropertyRepository', useClass: PrismaPropertyRepository },
  ],
  exports: [PropertyService],
})
export class PropertyModule {}
