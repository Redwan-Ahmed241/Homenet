import 'reflect-metadata';
import { UserController } from './user.controller.js';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator.js';

describe('UserController', () => {
  let controller: UserController;
  const mockUserService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    uploadAvatar: jest.fn(),
    removeAvatar: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UserController(mockUserService as any);
  });

  describe('Route Permissions Metadata', () => {
    it('findAll is protected with manage_users permission', () => {
      const permissions = Reflect.getMetadata(PERMISSIONS_KEY, UserController.prototype.findAll);
      expect(permissions).toEqual(['manage_users']);
    });

    it('remove is protected with manage_users permission', () => {
      const permissions = Reflect.getMetadata(PERMISSIONS_KEY, UserController.prototype.remove);
      expect(permissions).toEqual(['manage_users']);
    });
  });

  describe('update', () => {
    it('passes current user id to userService.update', async () => {
      const dto = { full_name: 'Jane Doe' };
      const currentUser = { id: 'user-caller-1', email: 'user@example.com' };

      mockUserService.update.mockResolvedValue({ id: 'target-1', full_name: 'Jane Doe' });

      await controller.update('target-1', dto, currentUser);

      expect(mockUserService.update).toHaveBeenCalledWith('target-1', dto, currentUser.id);
    });
  });
});
