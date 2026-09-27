import { UserService } from './user.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { USER_ERRORS } from '../../common/errors/error-codes.js';

describe('UserService', () => {
  let service: UserService;
  const mockUserRepo = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createUserAsset: jest.fn(),
    findUserAssetByUserAndSource: jest.fn(),
    deleteUserAsset: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockCacheService = {
    getOrSet: jest.fn((_key, fn) => fn()),
    del: jest.fn(),
    delMany: jest.fn(),
  };

  const mockUploadService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockRoleService = {
    hasPermission: jest.fn(),
    getUserPermissions: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService(
      mockUserRepo as any,
      mockLogger as any,
      mockCacheService as any,
      mockUploadService as any,
      mockRoleService as any,
    );
  });

  describe('update', () => {
    const targetUserId = 'user-123';
    const updateDto = { full_name: 'Updated Name' };

    it('allows a user to update their own profile without checking manage_users permission', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: targetUserId });
      mockUserRepo.update.mockResolvedValue({ id: targetUserId, full_name: 'Updated Name' });

      const result = await service.update(targetUserId, updateDto, targetUserId);

      expect(mockRoleService.hasPermission).not.toHaveBeenCalled();
      expect(mockUserRepo.update).toHaveBeenCalledWith(targetUserId, { full_name: 'Updated Name' });
      expect(result).toEqual({ id: targetUserId, full_name: 'Updated Name' });
    });

    it('allows an admin with manage_users permission to update another user profile', async () => {
      const adminUserId = 'admin-999';
      mockRoleService.hasPermission.mockResolvedValue(true);
      mockUserRepo.findById.mockResolvedValue({ id: targetUserId });
      mockUserRepo.update.mockResolvedValue({ id: targetUserId, full_name: 'Updated Name' });

      const result = await service.update(targetUserId, updateDto, adminUserId);

      expect(mockRoleService.hasPermission).toHaveBeenCalledWith(adminUserId, 'manage_users');
      expect(mockUserRepo.update).toHaveBeenCalledWith(targetUserId, { full_name: 'Updated Name' });
      expect(result).toEqual({ id: targetUserId, full_name: 'Updated Name' });
    });

    it('denies a user from updating another user profile when lacking manage_users permission', async () => {
      const otherUserId = 'other-456';
      mockRoleService.hasPermission.mockResolvedValue(false);

      await expect(
        service.update(targetUserId, updateDto, otherUserId),
      ).rejects.toThrow(AppException);

      expect(mockRoleService.hasPermission).toHaveBeenCalledWith(otherUserId, 'manage_users');
      expect(mockUserRepo.findById).not.toHaveBeenCalled();
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it('throws USER_NOT_FOUND if the user does not exist', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.update(targetUserId, updateDto, targetUserId),
      ).rejects.toThrow(AppException);
    });
  });

  describe('remove', () => {
    it('deletes user when user exists', async () => {
      mockUserRepo.findById.mockResolvedValue({ id: 'user-123' });
      mockUserRepo.delete.mockResolvedValue(undefined);

      const result = await service.remove('user-123');

      expect(mockUserRepo.delete).toHaveBeenCalledWith('user-123');
      expect(mockCacheService.delMany).toHaveBeenCalled();
      expect(result).toEqual({ message: "User with id 'user-123' has been deleted" });
    });

    it('throws USER_NOT_FOUND when user does not exist', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(service.remove('user-999')).rejects.toThrow(AppException);
    });
  });
});
