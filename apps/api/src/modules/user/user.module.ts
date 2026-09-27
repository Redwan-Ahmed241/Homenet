import { Module } from '@nestjs/common';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { PrismaUserRepository } from './repositories/prisma-user.repository.js';
import { UploadModule } from '../../common/upload/upload.module.js';
import { UploadService } from '../../common/upload/cloudinary.service.js';
import { RoleModule } from '../role/role.module.js';

@Module({
  imports: [UploadModule, RoleModule],
  controllers: [UserController],
  providers: [
    UserService,
    { provide: 'IUserRepository', useClass: PrismaUserRepository },
    { provide: 'IUploadService', useClass: UploadService },
  ],
  exports: [UserService],
})
export class UserModule {}
