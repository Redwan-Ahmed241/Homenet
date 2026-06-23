import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { LoggerService } from '../../common/logger/logger.service.js';

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
}
