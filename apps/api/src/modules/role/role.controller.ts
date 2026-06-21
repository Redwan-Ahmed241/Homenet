import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { RoleService } from './role.service';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  findAll() {
    return this.roleService.findAllRoles();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roleService.findRoleById(id);
  }

  // ── User ↔ Role ────────────────────────────────────────

  @Get('user/:userId')
  getUserRoles(@Param('userId') userId: string) {
    return this.roleService.getUserRoles(userId);
  }

  @Post('assign')
  assignRole(@Body() body: { userId: string; roleId: string }) {
    return this.roleService.assignRoleToUser(body.userId, body.roleId);
  }

  @Delete('revoke')
  removeRole(@Body() body: { userId: string; roleId: string }) {
    return this.roleService.removeRoleFromUser(body.userId, body.roleId);
  }

  // ── Role ↔ Permission ─────────────────────────────────

  @Post(':roleId/permissions')
  assignPermission(
    @Param('roleId') roleId: string,
    @Body() body: { permissionId: string },
  ) {
    return this.roleService.assignPermissionToRole(roleId, body.permissionId);
  }

  @Delete(':roleId/permissions/:permissionId')
  removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.roleService.removePermissionFromRole(roleId, permissionId);
  }
}
