import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AreaController } from './area.controller.js';
import { AreaService } from './area.service.js';
import { PrismaAreaRepository } from './repositories/prisma-area.repository.js';

@Module({
  imports: [
    CacheModule.register(),
  ],
  controllers: [AreaController],
  providers: [
    AreaService,
    { provide: 'IAreaRepository', useClass: PrismaAreaRepository },
  ],
  exports: [AreaService],
})
export class AreaModule {}
