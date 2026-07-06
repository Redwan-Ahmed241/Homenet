import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { LoggerService } from '../../common/logger/logger.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { USER_ERRORS } from '../../common/errors/error-codes.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
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
      },
    });

    this.logger.debug(`Fetched all users. Count: ${users.length}`, {
      fileName: 'user.service.ts',
      functionName: 'findAll',
      lineNumber: 27,
    });

    return users;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
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
      },
    });

    if (user) {
      this.logger.debug(`Fetched user profile for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'findOne',
        lineNumber: 49,
      });
    } else {
      this.logger.warn(`User profile not found for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'findOne',
        lineNumber: 55,
      });
    }

    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
  ): Promise<{
    id: string;
    full_name: string;
    avatar_url: string | null;
    created_at: Date;
    updated_at: Date;
    auth_identities: {
      provider: string;
      email: string | null;
      phone: string | null;
      verified_at: Date | null;
    }[];
  }> {
    // Check if user exists
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      this.logger.warn(`Update failed — user not found for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'update',
        lineNumber: 97,
      });
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.full_name !== undefined && { full_name: dto.full_name }),
          ...(dto.avatar_url !== undefined && { avatar_url: dto.avatar_url }),
        },
        select: {
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
        },
      });

      this.logger.debug(`Updated user profile for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'update',
        lineNumber: 129,
      });

      return user;
    } catch {
      this.logger.error(`Failed to update user for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'update',
        lineNumber: 136,
      });
      throw new AppException(USER_ERRORS.USER_UPDATE_FAILED);
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    // Check if user exists
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      this.logger.warn(`Delete failed — user not found for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'remove',
        lineNumber: 149,
      });
      throw new AppException(USER_ERRORS.USER_NOT_FOUND);
    }

    try {
      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.debug(`Deleted user with id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'remove',
        lineNumber: 161,
      });

      return { message: `User with id '${id}' has been deleted` };
    } catch {
      this.logger.error(`Failed to delete user for id: ${id}`, {
        fileName: 'user.service.ts',
        functionName: 'remove',
        lineNumber: 167,
      });
      throw new AppException(USER_ERRORS.USER_DELETE_FAILED);
    }
  }
}
