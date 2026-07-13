import { Injectable, Inject } from '@nestjs/common';
import type { ICacheService } from '../../common/cache/cache.service.interface.js';
import { CACHE_TTL } from '../../common/cache/cache.service.interface.js';
import { LoggerService } from '../../common/logger/logger.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { USER_ERRORS } from '../../common/errors/error-codes.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { IUserRepository } from './interfaces/user-repository.interface.js';
import type { IUploadService } from '../../common/upload/interfaces/upload.service.interface.js';
import { UPLOAD_FOLDERS, ALLOWED_MIMETYPES, UPLOAD_LIMITS_MB } from '../../common/upload/upload.constants.js';

@Injectable()
export class UserService {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    private readonly logger: LoggerService,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
    @Inject('IUploadService') private readonly uploadService: IUploadService,
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

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const existing = await this.userRepo.findById(userId);
    if (!existing) {
      this.logger.warn(`Upload avatar failed — user not found for id: ${userId}`, {
        fileName: 'user.service.ts',
        functionName: 'uploadAvatar',
        lineNumber: 55,
      });
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }

    // If user already has an avatar asset, delete old Cloudinary file and old asset
    const existingAsset = await this.userRepo.findUserAssetByUserAndSource(userId, 'AVATAR');
    if (existingAsset) {
      await this.uploadService.deleteFile(existingAsset.asset_id);
      await this.userRepo.deleteUserAsset(existingAsset.id);
    }

    const uploaded = await this.uploadService.uploadFile(
      file,
      UPLOAD_FOLDERS.USER_AVATAR.replace('{id}', userId),
      ALLOWED_MIMETYPES.IMAGES,
      UPLOAD_LIMITS_MB.IMAGE,
    );

    // Save the Cloudinary public_id in UserAsset and update avatar_url in User
    try {
      await this.userRepo.createUserAsset({
        user_id: userId,
        asset_id: uploaded.public_id,
        source: 'AVATAR',
      });

      const updated = await this.userRepo.update(userId, { avatar_url: uploaded.url });

      await this.cacheService.delMany([`users:profile:${userId}`, 'users:list']);

      this.logger.info(`Avatar uploaded for user: ${userId}`, {
        fileName: 'user.service.ts',
        functionName: 'uploadAvatar',
        lineNumber: 86,
      });

      return updated;
    } catch (error) {
      // If DB update failed, rollback: delete the uploaded file from Cloudinary
      this.logger.warn(`Rolling back Cloudinary upload for user: ${userId}`, {
        fileName: 'user.service.ts',
        functionName: 'uploadAvatar',
        lineNumber: 95,
      });
      await this.uploadService.deleteFile(uploaded.public_id);
      throw error;
    }
  }

  async removeAvatar(userId: string) {
    const existing = await this.userRepo.findById(userId);
    if (!existing) {
      this.logger.warn(`Remove avatar failed — user not found for id: ${userId}`, {
        fileName: 'user.service.ts',
        functionName: 'removeAvatar',
        lineNumber: 95,
      });
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }

    // Find the avatar asset record to get the Cloudinary public_id
    const avatarAsset = await this.userRepo.findUserAssetByUserAndSource(userId, 'AVATAR');
    if (!avatarAsset) {
      this.logger.warn(`Remove avatar failed — no avatar asset found for user: ${userId}`, {
        fileName: 'user.service.ts',
        functionName: 'removeAvatar',
        lineNumber: 108,
      });
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }

    // Delete from Cloudinary first using the stored public_id
    await this.uploadService.deleteFile(avatarAsset.asset_id);

    // Then delete the UserAsset record from DB
    await this.userRepo.deleteUserAsset(avatarAsset.id);

    // Then update the User table to remove avatar_url
    const updated = await this.userRepo.update(userId, { avatar_url: null });

    await this.cacheService.delMany([`users:profile:${userId}`, 'users:list']);

    this.logger.info(`Avatar removed for user: ${userId}`, {
      fileName: 'user.service.ts',
      functionName: 'removeAvatar',
      lineNumber: 130,
    });

    return updated;
  }
}
