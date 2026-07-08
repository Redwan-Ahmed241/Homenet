import { Injectable, Inject } from '@nestjs/common';
import type { IRoleRepository } from './interfaces/role-repository.interface.js';

@Injectable()
export class RoleService {
  constructor(
    @Inject('IRoleRepository') private readonly roleRepo: IRoleRepository,
  ) {}

  async findAllRoles() {
    return this.roleRepo.findAllRoles();
  }

  async findRoleById(id: string) {
    return this.roleRepo.findRoleById(id);
  }

  async assignRoleToUser(userId: string, roleId: string) {
    return this.roleRepo.assignRoleToUser(userId, roleId);
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    return this.roleRepo.removeRoleFromUser(userId, roleId);
  }

  async getUserRoles(userId: string) {
    return this.roleRepo.getUserRoles(userId);
  }

  async assignPermissionToRole(roleId: string, permissionId: string) {
    return this.roleRepo.assignPermissionToRole(roleId, permissionId);
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    return this.roleRepo.removePermissionFromRole(roleId, permissionId);
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    return this.roleRepo.getUserPermissions(userId);
  }
}
