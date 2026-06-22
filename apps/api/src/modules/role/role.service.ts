import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service.js';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.userRole.create({
      data: { user_id: userId, role_id: roleId },
    });
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    return this.prisma.userRole.deleteMany({
      where: { user_id: userId, role_id: roleId },
    });
  }

  async getUserRoles(userId: string) {
    return this.prisma.userRole.findMany({
      where: { user_id: userId },
      include: { role: true },
    });
  }

  // ── Role ↔ Permission ─────────────────────────────────

  async assignPermissionToRole(roleId: string, permissionId: string) {
    return this.prisma.rolePermission.create({
      data: { role_id: roleId, permission_id: permissionId },
    });
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    return this.prisma.rolePermission.deleteMany({
      where: { role_id: roleId, permission_id: permissionId },
    });
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

    const permissions = userRoles.flatMap((ur) =>
      ur.role.role_permissions.map((rp) => rp.permission.name),
    );

    return [...new Set(permissions)];
  }
}
