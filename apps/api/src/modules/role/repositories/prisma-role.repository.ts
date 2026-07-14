import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import type { IRoleRepository, RoleWithPermissions, UserRoleWithRole } from '../interfaces/role-repository.interface.js';

@Injectable()
export class PrismaRoleRepository implements IRoleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async findAllRoles(): Promise<RoleWithPermissions[]> {
    const roles = await this.prisma.role.findMany({
      include: { role_permissions: { include: { permission: true } } },
    });

    return roles as unknown as RoleWithPermissions[];
  }

  async findRoleById(id: string): Promise<RoleWithPermissions | null> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { role_permissions: { include: { permission: true } } },
    });

    return role as unknown as RoleWithPermissions | null;
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<{ id: string }> {
    const result = await this.prisma.userRole.create({
      data: { user_id: userId, role_id: roleId },
      select: { id: true },
    });

    this.logger.info(`Assigned role ${roleId} to user ${userId}`, {
      fileName: 'prisma-role.repository.ts',
      functionName: 'assignRoleToUser',
      lineNumber: 37,
    });

    return result;
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<{ count: number }> {
    const result = await this.prisma.userRole.deleteMany({
      where: { user_id: userId, role_id: roleId },
    });

    this.logger.info(`Removed role ${roleId} from user ${userId}`, {
      fileName: 'prisma-role.repository.ts',
      functionName: 'removeRoleFromUser',
      lineNumber: 50,
    });

    return { count: result.count };
  }

  async getUserRoles(userId: string): Promise<UserRoleWithRole[]> {
    const roles = await this.prisma.userRole.findMany({
      where: { user_id: userId },
      include: { role: true },
    });

    return roles as unknown as UserRoleWithRole[];
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<{ id: string }> {
    const result = await this.prisma.rolePermission.create({
      data: { role_id: roleId, permission_id: permissionId },
      select: { id: true },
    });

    this.logger.info(`Assigned permission ${permissionId} to role ${roleId}`, {
      fileName: 'prisma-role.repository.ts',
      functionName: 'assignPermissionToRole',
      lineNumber: 73,
    });

    return result;
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<{ count: number }> {
    const result = await this.prisma.rolePermission.deleteMany({
      where: { role_id: roleId, permission_id: permissionId },
    });

    this.logger.info(`Removed permission ${permissionId} from role ${roleId}`, {
      fileName: 'prisma-role.repository.ts',
      functionName: 'removePermissionFromRole',
      lineNumber: 86,
    });

    return { count: result.count };
  }

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
