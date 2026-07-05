import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AreaController } from './area.controller.js';
import { AreaService } from './area.service.js';

@Module({
  imports: [
    CacheModule.register(),
  ],
  controllers: [AreaController],
  providers: [AreaService],
  exports: [AreaService],
})
export class AreaModule {}
