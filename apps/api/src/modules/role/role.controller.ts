import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { AssignPermissionDto } from './dto/assign-permission.dto.js';

@Controller('v1/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Permissions('view_roles')
  @Get()
  findAll() {
    return this.roleService.findAllRoles();
  }

  @Permissions('view_roles')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roleService.findRoleById(id);
  }

  // ── User ↔ Role ────────────────────────────────────────

  // Anyone may read their own roles: the app loads them after every sign-in
  // to decide what to show. Someone else's roles still need view_roles. The
  // check lives here because PermissionsGuard cannot tell whose roles these are.
  @Get('user/:userId')
  async getUserRoles(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (userId !== user.id && !(await this.roleService.hasPermission(user.id, 'view_roles'))) {
      throw new ForbiddenException();
    }
    return this.roleService.getUserRoles(userId);
  }

  @Permissions('manage_roles')
  @Post('assign')
  assignRole(@Body() dto: AssignRoleDto) {
    return this.roleService.assignRoleToUser(dto.userId, dto.roleId);
  }

  @Permissions('manage_roles')
  @Delete('revoke')
  removeRole(@Body() dto: AssignRoleDto) {
    return this.roleService.removeRoleFromUser(dto.userId, dto.roleId);
  }

  // ── Role ↔ Permission ─────────────────────────────────

  @Permissions('manage_roles')
  @Post(':roleId/permissions')
  assignPermission(
    @Param('roleId') roleId: string,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.roleService.assignPermissionToRole(roleId, dto.permissionId);
  }

  @Permissions('manage_roles')
  @Delete(':roleId/permissions/:permissionId')
  removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.roleService.removePermissionFromRole(roleId, permissionId);
  }
}
