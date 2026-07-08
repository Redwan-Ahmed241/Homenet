import { Injectable, Inject } from '@nestjs/common';
import type { ICacheService } from '../../common/cache/cache.service.interface.js';
import { CACHE_TTL } from '../../common/cache/cache.service.interface.js';
import type { IRoleRepository } from './interfaces/role-repository.interface.js';

@Injectable()
export class RoleService {
  constructor(
    @Inject('IRoleRepository') private readonly roleRepo: IRoleRepository,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
  ) {}

  async findAllRoles() {
    return this.cacheService.getOrSet('roles:list', () => this.roleRepo.findAllRoles(), CACHE_TTL.LIST);
  }

  async findRoleById(id: string) {
    return this.roleRepo.findRoleById(id);
  }

  async assignRoleToUser(userId: string, roleId: string) {
    const result = await this.roleRepo.assignRoleToUser(userId, roleId);
    await this.cacheService.delMany([`roles:permissions:${userId}`, `roles:user:${userId}`]);
    return result;
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    const result = await this.roleRepo.removeRoleFromUser(userId, roleId);
    await this.cacheService.delMany([`roles:permissions:${userId}`, `roles:user:${userId}`]);
    return result;
  }

  async getUserRoles(userId: string) {
    return this.cacheService.getOrSet(`roles:user:${userId}`, () => this.roleRepo.getUserRoles(userId), CACHE_TTL.DETAIL);
  }

  async assignPermissionToRole(roleId: string, permissionId: string) {
    const result = await this.roleRepo.assignPermissionToRole(roleId, permissionId);
    await this.cacheService.del('roles:list');
    return result;
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    const result = await this.roleRepo.removePermissionFromRole(roleId, permissionId);
    await this.cacheService.del('roles:list');
    return result;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    return this.cacheService.getOrSet(
      `roles:permissions:${userId}`,
      () => this.roleRepo.getUserPermissions(userId),
      CACHE_TTL.DETAIL,
    );
  }
}
