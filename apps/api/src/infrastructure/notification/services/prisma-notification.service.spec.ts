import { Prisma } from '@prisma/client';
import { PrismaNotificationService } from './prisma-notification.service.js';

describe('PrismaNotificationService', () => {
  const prisma = {
    notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    user: { findMany: jest.fn() },
  };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const service = new PrismaNotificationService(prisma as any, logger as any);
  const event = {
    type: 'listing.approved',
    title: 'Your listing is live',
    message: 'm',
  };

  beforeEach(() => jest.clearAllMocks());

  it('stores one row per recipient, defaulting to the user portal', async () => {
    await service.sendToMany(['a', 'b', 'a', ''], {
      ...event,
      link: '/property/p1',
    });

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          user_id: 'a',
          audience: 'user',
          link: '/property/p1',
        }),
        expect.objectContaining({
          user_id: 'b',
          audience: 'user',
          link: '/property/p1',
        }),
      ],
    });
  });

  it('stores missing metadata as SQL NULL', async () => {
    await service.send('a', event);
    expect(
      prisma.notification.createMany.mock.calls[0][0].data[0].metadata,
    ).toBe(Prisma.DbNull);
  });

  it('does nothing without recipients', async () => {
    await service.sendToMany([], event);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('sends admin notifications to every moderator, in the admin portal', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1' },
      { id: 'admin-2' },
    ]);

    await service.sendToAdmins({ ...event, audience: 'user' });

    // Same rule as PermissionsGuard, so notifications reach exactly who can act on them.
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        user_roles: {
          some: {
            role: {
              role_permissions: {
                some: { permission: { name: 'moderate_listing' } },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ user_id: 'admin-1', audience: 'admin' }),
        expect.objectContaining({ user_id: 'admin-2', audience: 'admin' }),
      ],
    });
  });

  it('never throws, so a failed notification cannot fail the action behind it', async () => {
    prisma.notification.createMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.send('a', event)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();

    prisma.user.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.sendToAdmins(event)).resolves.toBeUndefined();
  });
});
