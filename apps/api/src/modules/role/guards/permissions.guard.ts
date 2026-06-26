import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;

    if (!userId) {
      return false;
    }

    const match = await this.prisma.userRole.count({
      where: {
        user_id: userId,
        role: {
          role_permissions: {
            some: {
              permission: {
                name: { in: requiredPermissions },
              },
            },
          },
        },
      },
    });

    return match > 0;
  }
}
