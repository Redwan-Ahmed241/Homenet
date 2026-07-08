import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { handlePrismaError } from '../../../common/database/prisma-error-handler.js';
import { USER_ERRORS } from '../../../common/errors/error-codes.js';
import type { IUserRepository, UserProfile, UserExists } from '../interfaces/user-repository.interface.js';

const userSelect = {
  id: true,
  full_name: true,
  avatar_url: true,
  created_at: true,
  updated_at: true,
  auth_identities: {
    select: {
      provider: true,
      email: true,
      phone: true,
      verified_at: true,
    },
  },
} as const;

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async findAll(): Promise<UserProfile[]> {
    const users = await this.prisma.user.findMany({ select: userSelect });

    this.logger.debug(`Fetched all users. Count: ${users.length}`, {
      fileName: 'prisma-user.repository.ts',
      functionName: 'findAll',
      lineNumber: 31,
    });

    return users as unknown as UserProfile[];
  }

  async findById(id: string): Promise<UserExists | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    return user;
  }

  async findOne(id: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (user) {
      this.logger.debug(`Fetched user profile for id: ${id}`, {
        fileName: 'prisma-user.repository.ts',
        functionName: 'findOne',
        lineNumber: 55,
      });
    } else {
      this.logger.warn(`User profile not found for id: ${id}`, {
        fileName: 'prisma-user.repository.ts',
        functionName: 'findOne',
        lineNumber: 60,
      });
    }

    return user as unknown as UserProfile | null;
  }

  async update(
    id: string,
    data: { full_name?: string; avatar_url?: string | null },
  ): Promise<UserProfile> {
    const userSelectTyped = {
      id: true,
      full_name: true,
      avatar_url: true,
      created_at: true,
      updated_at: true,
      auth_identities: {
        select: {
          provider: true,
          email: true,
          phone: true,
          verified_at: true,
        },
      },
    } as const;

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.full_name !== undefined && { full_name: data.full_name }),
          ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
        },
        select: userSelectTyped,
      });

      this.logger.debug(`Updated user profile for id: ${id}`, {
        fileName: 'prisma-user.repository.ts',
        functionName: 'update',
        lineNumber: 99,
      });

      return user as unknown as UserProfile;
    } catch (error) {
      this.logger.error(`Failed to update user for id: ${id}`, {
        fileName: 'prisma-user.repository.ts',
        functionName: 'update',
        lineNumber: 105,
      });
      handlePrismaError(error, {
        modelName: 'User',
        notFoundError: USER_ERRORS.USER_NOT_FOUND,
      });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });

      this.logger.debug(`Deleted user with id: ${id}`, {
        fileName: 'prisma-user.repository.ts',
        functionName: 'delete',
        lineNumber: 120,
      });
    } catch (error) {
      this.logger.error(`Failed to delete user for id: ${id}`, {
        fileName: 'prisma-user.repository.ts',
        functionName: 'delete',
        lineNumber: 126,
      });
      handlePrismaError(error, {
        modelName: 'User',
        notFoundError: USER_ERRORS.USER_NOT_FOUND,
      });
    }
  }
}
