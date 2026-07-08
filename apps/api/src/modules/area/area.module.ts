import { Module } from '@nestjs/common';
import { AreaController } from './area.controller.js';
import { AreaService } from './area.service.js';
import { PrismaAreaRepository } from './repositories/prisma-area.repository.js';

@Module({
  controllers: [AreaController],
  providers: [
    AreaService,
    { provide: 'IAreaRepository', useClass: PrismaAreaRepository },
  ],
  exports: [AreaService],
})
export class AreaModule {}
