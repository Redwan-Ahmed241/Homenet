import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        phone: true,
        email: true,
        full_name: true,
        avatar_url: true,
        phone_verified_at: true,
        email_verified_at: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        email: true,
        full_name: true,
        avatar_url: true,
        phone_verified_at: true,
        email_verified_at: true,
        created_at: true,
        updated_at: true,
      },
    });
  }
}
