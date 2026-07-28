import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { PrismaRoleRepository } from './repositories/prisma-role.repository.js';

@Module({
  controllers: [RoleController],
  providers: [
    RoleService,
    { provide: 'IRoleRepository', useClass: PrismaRoleRepository },
  ],
  exports: [RoleService],
})
export class RoleModule {}
