import { PropertyService } from './property.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import {
  LISTING_EVENTS,
  ListingPriceChangedEvent,
  ListingStatusChangedEvent,
  ListingSubmittedEvent,
} from './events/listing.events.js';

/** A listing that passes every submit check. */
const listing = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  user_id: 'owner-1',
  type: 'residential',
  status: 'pending',
  title: 'Flat in Mohammadpur',
  description: 'Bright 3-bed flat',
  listing_type: 'sale',
  price: 9_000_000,
  price_currency: 'BDT',
  area_id: 'area-1',
  area_size: 1200,
  area_unit: 'sqft',
  address: 'Road 5, Mohammadpur',
  location_lat: 23.76,
  location_lng: 90.36,
  subtype: 'apartment',
  amenities: { bedrooms: 3, bathrooms: 2 },
  ...overrides,
});

function setup(env: Record<string, string> = {}) {
  const repo = {
    findById: jest.fn().mockResolvedValue(listing()),
    update: jest.fn().mockResolvedValue({ id: 'p1' }),
    countMediaTotal: jest.fn().mockResolvedValue(3),
    createVerification: jest.fn().mockResolvedValue({ id: 'v1' }),
    findAreaById: jest.fn().mockResolvedValue({ id: 'area-1' }),
  };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const cache = { delMany: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn((key: string) => env[key]) };
  const backgroundTasks = {
    enqueueVerification: jest.fn().mockResolvedValue(undefined),
  };
  const events = { emitAsync: jest.fn().mockResolvedValue([]) };

  const service = new PropertyService(
    repo as any,
    logger as any,
    cache as any,
    {} as any,
    config as any,
    backgroundTasks,
    events as any,
  );
  return { service, repo, logger, backgroundTasks, events };
}

describe('PropertyService — submit', () => {
  it('does not run the mock verifier unless VERIFICATION_MODE=mock', async () => {
    const { service, backgroundTasks } = setup();
    await service.submitForVerification('p1', 'owner-1');
    expect(backgroundTasks.enqueueVerification).not.toHaveBeenCalled();
  });

  it('runs the mock verifier when deliberately enabled', async () => {
    const { service, backgroundTasks } = setup({ VERIFICATION_MODE: 'mock' });
    await service.submitForVerification('p1', 'owner-1');
    expect(backgroundTasks.enqueueVerification).toHaveBeenCalledWith('p1');
  });

  it('tells admins a listing is waiting for review', async () => {
    const { service, events } = setup();
    await service.submitForVerification('p1', 'owner-1');
    expect(events.emitAsync).toHaveBeenCalledWith(
      LISTING_EVENTS.SUBMITTED,
      new ListingSubmittedEvent('p1', 'owner-1', 'Flat in Mohammadpur'),
    );
  });
});

describe('PropertyService — update events', () => {
  it('reports an admin approval as a status change', async () => {
    const { service, events } = setup();
    await service.upsert(
      { property_id: 'p1', status: 'active' } as any,
      'admin-1',
      true,
    );
    expect(events.emitAsync).toHaveBeenCalledWith(
      LISTING_EVENTS.STATUS_CHANGED,
      new ListingStatusChangedEvent(
        'p1',
        'owner-1',
        'Flat in Mohammadpur',
        'pending',
        'active',
        true,
      ),
    );
  });

  it('reports a price change with both prices', async () => {
    const { service, repo, events } = setup();
    repo.findById.mockResolvedValue(listing({ status: 'active' }));
    // Only an explicit status keeps a listing live through an edit: every other
    // edit — owner or admin — is recomputed to pending (see the next test).
    await service.upsert(
      { property_id: 'p1', price: 8_500_000, status: 'active' } as any,
      'admin-1',
      true,
    );
    expect(events.emitAsync).toHaveBeenCalledWith(
      LISTING_EVENTS.PRICE_CHANGED,
      new ListingPriceChangedEvent(
        'p1',
        'owner-1',
        'Flat in Mohammadpur',
        'active',
        9_000_000,
        8_500_000,
        'BDT',
      ),
    );
  });

  it('reports the existing rule that an owner edit sends a live listing back to review', async () => {
    // Pre-existing behaviour, recorded here so a change to it is deliberate:
    // computeStatus() only yields draft or pending, so an owner editing an
    // active listing moves it to pending. The price event then carries
    // "pending", and the listener deliberately sends no price-drop alert for a
    // listing nobody can currently open.
    const { service, repo, events } = setup();
    repo.findById.mockResolvedValue(listing({ status: 'active' }));
    await service.upsert({ property_id: 'p1', price: 8_500_000 }, 'owner-1');
    expect(events.emitAsync).toHaveBeenCalledWith(
      LISTING_EVENTS.STATUS_CHANGED,
      new ListingStatusChangedEvent(
        'p1',
        'owner-1',
        'Flat in Mohammadpur',
        'active',
        'pending',
        false,
      ),
    );
    expect(events.emitAsync).toHaveBeenCalledWith(
      LISTING_EVENTS.PRICE_CHANGED,
      new ListingPriceChangedEvent(
        'p1',
        'owner-1',
        'Flat in Mohammadpur',
        'pending',
        9_000_000,
        8_500_000,
        'BDT',
      ),
    );
  });

  it('emits nothing when neither status nor price changed', async () => {
    const { service, events } = setup(); // pending listing; recomputed status stays pending
    await service.upsert(
      { property_id: 'p1', description: 'Freshly painted' },
      'owner-1',
    );
    expect(events.emitAsync).not.toHaveBeenCalled();
  });

  it('still saves the listing when a listener fails', async () => {
    const { service, events, logger } = setup();
    events.emitAsync.mockRejectedValueOnce(new Error('listener exploded'));
    await expect(
      service.upsert(
        { property_id: 'p1', status: 'active' } as any,
        'admin-1',
        true,
      ),
    ).resolves.toEqual({ id: 'p1' });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('PropertyService — parking validation (FR-02)', () => {
  it('rejects turning a flat into parking while it still has bedrooms', async () => {
    const { service, repo } = setup();
    await expect(
      service.upsert({ property_id: 'p1', type: 'parking' } as any, 'owner-1'),
    ).rejects.toBeInstanceOf(AppException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts a flat converted to parking once its rooms are cleared', async () => {
    const { service, repo } = setup();
    await service.upsert(
      {
        property_id: 'p1',
        type: 'parking',
        subtype: 'garage',
        amenities: { covered: true },
      } as any,
      'owner-1',
    );
    expect(repo.update).toHaveBeenCalled();
  });

  it('stores room counts as numbers so the bedroom filters match', async () => {
    const { service, repo } = setup();
    await service.upsert(
      {
        property_id: 'p1',
        amenities: { bedrooms: '4', bathrooms: '3' },
      },
      'owner-1',
    );
    expect(repo.update).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ amenities: { bedrooms: 4, bathrooms: 3 } }),
    );
  });

  it('leaves unrelated updates alone, even on legacy data', async () => {
    const { service, repo } = setup();
    // Legacy row that would fail today's rules; a price edit must still save.
    repo.findById.mockResolvedValue(
      listing({ type: 'land', amenities: { bedrooms: 2 } }),
    );
    await service.upsert({ property_id: 'p1', price: 8_000_000 }, 'owner-1');
    expect(repo.update).toHaveBeenCalled();
  });
});
