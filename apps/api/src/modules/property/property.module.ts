import { Module } from '@nestjs/common';
import { PropertyController } from './property.controller.js';
import { PropertyService } from './property.service.js';
import { PrismaPropertyRepository } from './repositories/prisma-property.repository.js';

@Module({
  controllers: [PropertyController],
  providers: [
    PropertyService,
    { provide: 'IPropertyRepository', useClass: PrismaPropertyRepository },
  ],
  exports: [PropertyService],
})
export class PropertyModule {}
