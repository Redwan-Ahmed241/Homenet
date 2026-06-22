import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
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
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
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
  }
}
