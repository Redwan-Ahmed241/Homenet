import { Injectable, Inject } from '@nestjs/common';
import { LoggerService } from '../../common/logger/logger.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { USER_ERRORS } from '../../common/errors/error-codes.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { IUserRepository } from './interfaces/user-repository.interface.js';

@Injectable()
export class UserService {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    private readonly logger: LoggerService,
  ) {}

  async findAll() {
    return this.userRepo.findAll();
  }

  async findOne(id: string) {
    return this.userRepo.findOne(id);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
  ) {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      this.logger.warn(`Update failed — user not found for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'update',
        lineNumber: 34,
      });
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }

    return this.userRepo.update(id, {
      full_name: dto.full_name,
      avatar_url: dto.avatar_url,
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      this.logger.warn(`Delete failed — user not found for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'remove',
        lineNumber: 49,
      });
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }

    await this.userRepo.delete(id);

    return { message: `User with id '${id}' has been deleted` };
  }
}
