import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { LoggerService } from '../../common/logger/logger.service.js';

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  // ── Roles ──────────────────────────────────────────────

  async findAllRoles() {
    return this.prisma.role.findMany({
      include: { role_permissions: { include: { permission: true } } },
    });
  }

  async findRoleById(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
      include: { role_permissions: { include: { permission: true } } },
    });
  }

  // ── User ↔ Role ────────────────────────────────────────

  async assignRoleToUser(userId: string, roleId: string) {
    const result = await this.prisma.userRole.create({
      data: { user_id: userId, role_id: roleId },
    });

    this.logger.info(`Assigned role ${roleId} to user ${userId}`, {
      fileName: 'role.service.ts',
      functionName: 'assignRoleToUser',
      lineNumber: 31,
    });

    return result;
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    const result = await this.prisma.userRole.deleteMany({
      where: { user_id: userId, role_id: roleId },
    });

    this.logger.info(`Removed role ${roleId} from user ${userId}`, {
      fileName: 'role.service.ts',
      functionName: 'removeRoleFromUser',
      lineNumber: 42,
    });

    return result;
  }

  async getUserRoles(userId: string) {
    return this.prisma.userRole.findMany({
      where: { user_id: userId },
      include: { role: true },
    });
  }

  // ── Role ↔ Permission ─────────────────────────────────

  async assignPermissionToRole(roleId: string, permissionId: string) {
    const result = await this.prisma.rolePermission.create({
      data: { role_id: roleId, permission_id: permissionId },
    });

    this.logger.info(`Assigned permission ${permissionId} to role ${roleId}`, {
      fileName: 'role.service.ts',
      functionName: 'assignPermissionToRole',
      lineNumber: 65,
    });

    return result;
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    const result = await this.prisma.rolePermission.deleteMany({
      where: { role_id: roleId, permission_id: permissionId },
    });

    this.logger.info(`Removed permission ${permissionId} from role ${roleId}`, {
      fileName: 'role.service.ts',
      functionName: 'removePermissionFromRole',
      lineNumber: 76,
    });

    return result;
  }

  // ── Permission check ──────────────────────────────────

  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: userId },
      include: {
        role: {
          include: {
            role_permissions: { include: { permission: true } },
          },
        },
      },
    });

    const permissions = userRoles.flatMap((ur: { role: { role_permissions: { permission: { name: string } }[] } }) =>
      ur.role.role_permissions.map((rp: { permission: { name: string } }) => rp.permission.name),
    );

    return [...new Set(permissions)] as string[];
  }
}
