import { Module } from '@nestjs/common';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { PrismaUserRepository } from './repositories/prisma-user.repository.js';
import { UploadModule } from '../../common/upload/upload.module.js';
import { UploadService } from '../../common/upload/cloudinary.service.js';

@Module({
  imports: [UploadModule],
  controllers: [UserController],
  providers: [
    UserService,
    { provide: 'IUserRepository', useClass: PrismaUserRepository },
    { provide: 'IUploadService', useClass: UploadService },
  ],
  exports: [UserService],
})
export class UserModule {}
