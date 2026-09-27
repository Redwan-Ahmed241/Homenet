import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { RoleController } from './role.controller.js';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator.js';

describe('RoleController', () => {
  let controller: RoleController;
  const mockRoleService = {
    getUserRoles: jest.fn(),
    hasPermission: jest.fn(),
  };
  const caller = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new RoleController(mockRoleService as any);
    mockRoleService.getUserRoles.mockResolvedValue([]);
  });

  describe('getUserRoles', () => {
    it('has no route-level permission, so users can reach their own roles', () => {
      const permissions = Reflect.getMetadata(PERMISSIONS_KEY, RoleController.prototype.getUserRoles);
      expect(permissions).toBeUndefined();
    });

    it('returns the caller their own roles without checking view_roles', async () => {
      await controller.getUserRoles('user-1', caller as any);

      expect(mockRoleService.hasPermission).not.toHaveBeenCalled();
      expect(mockRoleService.getUserRoles).toHaveBeenCalledWith('user-1');
    });

    it("returns another user's roles to a holder of view_roles", async () => {
      mockRoleService.hasPermission.mockResolvedValue(true);

      await controller.getUserRoles('user-2', caller as any);

      expect(mockRoleService.hasPermission).toHaveBeenCalledWith('user-1', 'view_roles');
      expect(mockRoleService.getUserRoles).toHaveBeenCalledWith('user-2');
    });

    it("refuses another user's roles without view_roles", async () => {
      mockRoleService.hasPermission.mockResolvedValue(false);

      await expect(controller.getUserRoles('user-2', caller as any)).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockRoleService.getUserRoles).not.toHaveBeenCalled();
    });
  });
});
