import { Injectable, Inject } from '@nestjs/common';
import type { ICacheService } from '../../common/cache/cache.service.interface.js';
import { CACHE_TTL } from '../../common/cache/cache.service.interface.js';
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
    @Inject('ICacheService') private readonly cacheService: ICacheService,
  ) {}

  async findAll() {
    return this.cacheService.getOrSet('users:list', () => this.userRepo.findAll(), CACHE_TTL.LIST);
  }

  async findOne(id: string) {
    return this.cacheService.getOrSet(`users:profile:${id}`, () => this.userRepo.findOne(id), CACHE_TTL.DETAIL);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      this.logger.warn(`Update failed — user not found for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'update',
        lineNumber: 32,
      });
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }

    const updated = await this.userRepo.update(id, {
      full_name: dto.full_name,
      avatar_url: dto.avatar_url,
    });

    await this.cacheService.delMany([`users:profile:${id}`, 'users:list']);
    return updated;
  }

  async remove(id: string): Promise<{ message: string }> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      this.logger.warn(`Delete failed — user not found for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'remove',
        lineNumber: 47,
      });
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }

    await this.userRepo.delete(id);

    await this.cacheService.delMany([`users:profile:${id}`, 'users:list']);

    return { message: `User with id '${id}' has been deleted` };
  }
}
