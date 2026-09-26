import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service.js';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'n1',
  user_id: 'user-1',
  audience: 'user',
  type: 'listing.approved',
  title: 'Your listing is live',
  message: '"Flat" is now visible.',
  link: '/property/p1',
  metadata: null,
  read_at: null,
  created_at: new Date('2026-09-27T10:00:00Z'),
  ...overrides,
});

describe('NotificationService', () => {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new NotificationService(prisma as any);

  beforeEach(() => jest.resetAllMocks());

  it("lists only the caller's notifications for the requested portal, newest first", async () => {
    prisma.notification.findMany.mockResolvedValue([row()]);
    prisma.notification.count.mockResolvedValue(1);

    const result = await service.list('user-1', {
      audience: 'admin',
      page: 2,
      limit: 10,
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1', audience: 'admin' },
      orderBy: { created_at: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      limit: 10,
      total_pages: 1,
    });
  });

  it('defaults to the user portal', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);

    await service.list('user-1', {});

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1', audience: 'user' },
      }),
    );
  });

  it('can list unread only', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);

    await service.list('user-1', { unread_only: true });

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { user_id: 'user-1', audience: 'user', read_at: null },
    });
  });

  it('returns the shape the app reads, with a read flag', async () => {
    prisma.notification.findMany.mockResolvedValue([
      row(),
      row({ id: 'n2', read_at: new Date() }),
    ]);
    prisma.notification.count.mockResolvedValue(2);

    const { items } = await service.list('user-1', {});

    expect(items.map((item) => item.read)).toEqual([false, true]);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: 'n1',
        link: '/property/p1',
        message: '"Flat" is now visible.',
      }),
    );
  });

  it('counts unread notifications for one portal', async () => {
    prisma.notification.count.mockResolvedValue(4);

    expect(await service.unreadCount('user-1', 'admin')).toEqual({ count: 4 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { user_id: 'user-1', audience: 'admin', read_at: null },
    });
  });

  it('marks a notification read only for its owner', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await service.markRead('user-1', 'n1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', user_id: 'user-1', read_at: null },
      data: { read_at: expect.any(Date) },
    });
  });

  it('treats marking an already-read notification as success', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.count.mockResolvedValue(1);

    await expect(service.markRead('user-1', 'n1')).resolves.toEqual({
      id: 'n1',
      read: true,
    });
  });

  it("reports someone else's notification as not found", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.count.mockResolvedValue(0);

    await expect(service.markRead('user-2', 'n1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('marks everything read for one portal', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    expect(await service.markAllRead('user-1', 'user')).toEqual({ updated: 3 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1', audience: 'user', read_at: null },
      data: { read_at: expect.any(Date) },
    });
  });
});
