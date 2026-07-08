import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaUserRepository } from './repositories/prisma-user.repository.js';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    { provide: 'IUserRepository', useClass: PrismaUserRepository },
  ],
  exports: [UserService],
})
export class UserModule {}
