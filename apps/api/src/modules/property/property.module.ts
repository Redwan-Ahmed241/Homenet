import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PropertyController } from './property.controller.js';
import { PropertyService } from './property.service.js';

@Module({
  imports: [
    CacheModule.register(),
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
