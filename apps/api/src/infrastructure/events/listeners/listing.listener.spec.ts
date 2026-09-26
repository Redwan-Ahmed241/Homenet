import { ListingListener, formatTaka } from './listing.listener.js';
import {
  ListingPriceChangedEvent,
  ListingStatusChangedEvent,
  ListingSubmittedEvent,
} from '../../../modules/property/events/listing.events.js';

describe('ListingListener', () => {
  const notification = {
    send: jest.fn().mockResolvedValue(undefined),
    sendToMany: jest.fn().mockResolvedValue(undefined),
    sendToAdmins: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    savedProperty: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ user_id: 'saver-1' }, { user_id: 'saver-2' }]),
    },
  };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const listener = new ListingListener(
    notification,
    prisma as any,
    logger as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('tells admins when a listing is submitted', async () => {
    await listener.onSubmitted(
      new ListingSubmittedEvent('p1', 'owner-1', 'Flat in Mohammadpur'),
    );

    expect(notification.sendToAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'listing.submitted',
        link: '/admin/properties',
        message: expect.stringContaining('Flat in Mohammadpur'),
      }),
    );
  });

  it('tells the owner when an admin approves the listing', async () => {
    await listener.onStatusChanged(
      new ListingStatusChangedEvent(
        'p1',
        'owner-1',
        'Flat',
        'pending',
        'active',
        true,
      ),
    );

    expect(notification.send).toHaveBeenCalledWith(
      'owner-1',
      expect.objectContaining({
        type: 'listing.approved',
        link: '/property/p1',
      }),
    );
  });

  it('tells the owner when an admin sends the listing back', async () => {
    await listener.onStatusChanged(
      new ListingStatusChangedEvent(
        'p1',
        'owner-1',
        'Flat',
        'pending',
        'draft',
        true,
      ),
    );

    expect(notification.send).toHaveBeenCalledWith(
      'owner-1',
      expect.objectContaining({
        type: 'listing.not_approved',
        link: '/my-properties',
      }),
    );
  });

  it('does not notify on status changes the owner made while editing', async () => {
    await listener.onStatusChanged(
      new ListingStatusChangedEvent(
        'p1',
        'owner-1',
        'Flat',
        'draft',
        'pending',
        false,
      ),
    );

    expect(notification.send).not.toHaveBeenCalled();
    expect(notification.sendToMany).not.toHaveBeenCalled();
  });

  it('tells savers, but not the owner, when a listing sells', async () => {
    await listener.onStatusChanged(
      new ListingStatusChangedEvent(
        'p1',
        'owner-1',
        'Flat',
        'active',
        'sold',
        true,
      ),
    );

    expect(prisma.savedProperty.findMany).toHaveBeenCalledWith({
      where: { property_id: 'p1', user_id: { not: 'owner-1' } },
      select: { user_id: true },
    });
    expect(notification.sendToMany).toHaveBeenCalledWith(
      ['saver-1', 'saver-2'],
      expect.objectContaining({ type: 'saved.sold' }),
    );
  });

  it('tells savers when the price of a live listing drops', async () => {
    await listener.onPriceChanged(
      new ListingPriceChangedEvent(
        'p1',
        'owner-1',
        'Flat',
        'active',
        9_000_000,
        8_500_000,
        'BDT',
      ),
    );

    expect(notification.sendToMany).toHaveBeenCalledWith(
      ['saver-1', 'saver-2'],
      expect.objectContaining({
        type: 'saved.price_drop',
        message: '"Flat" dropped from ৳90 lakh to ৳85 lakh.',
      }),
    );
  });

  it('stays quiet about price rises', async () => {
    await listener.onPriceChanged(
      new ListingPriceChangedEvent(
        'p1',
        'owner-1',
        'Flat',
        'active',
        8_500_000,
        9_000_000,
        'BDT',
      ),
    );
    expect(notification.sendToMany).not.toHaveBeenCalled();
  });

  it('stays quiet about price changes on listings nobody can see', async () => {
    await listener.onPriceChanged(
      new ListingPriceChangedEvent(
        'p1',
        'owner-1',
        'Flat',
        'draft',
        9_000_000,
        8_000_000,
        'BDT',
      ),
    );
    expect(notification.sendToMany).not.toHaveBeenCalled();
  });

  it('logs and carries on when savers cannot be loaded', async () => {
    prisma.savedProperty.findMany.mockRejectedValueOnce(new Error('db down'));

    await listener.onStatusChanged(
      new ListingStatusChangedEvent(
        'p1',
        'owner-1',
        'Flat',
        'active',
        'sold',
        true,
      ),
    );

    expect(logger.error).toHaveBeenCalled();
    expect(notification.sendToMany).toHaveBeenCalledWith([], expect.anything());
  });
});

describe('formatTaka', () => {
  it('speaks prices the way they are said in Bangladesh', () => {
    expect(formatTaka(25_000_000, 'BDT')).toBe('৳2.5 crore');
    expect(formatTaka(8_500_000, 'BDT')).toBe('৳85 lakh');
    expect(formatTaka(35_000, 'BDT')).toBe('৳35,000');
    expect(formatTaka(1200, 'USD')).toBe('USD 1,200');
  });
});
