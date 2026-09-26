import { LlmRotatorService } from './llm-rotator.service.js';
import type { VaultKey } from './llm.types.js';

function key(id: string, accountId: string): VaultKey {
  return {
    id,
    alias: id,
    accountId,
    maskedKey: 'gsk_...0000',
    client: {} as VaultKey['client'],
  };
}

describe('LlmRotatorService', () => {
  // Interleaved ring: A1-k1, A2-k1, A3-k1, A1-k2, A2-k2, A3-k2
  const ring = [
    key('k1', 'A1'),
    key('k2', 'A2'),
    key('k3', 'A3'),
    key('k4', 'A1'),
    key('k5', 'A2'),
    key('k6', 'A3'),
  ];

  let counter: number;
  let cooled: string[];
  let revoked: string[];
  let rotator: LlmRotatorService;

  beforeEach(() => {
    counter = 0;
    cooled = [];
    revoked = [];
    const prisma = {
      $queryRaw: jest.fn(() =>
        Promise.resolve([
          {
            counter: BigInt(++counter),
            cooled_accounts: cooled,
            revoked_key_ids: revoked,
            fingerprint: 'fp',
          },
        ]),
      ),
    };
    const vault = { ensureFresh: jest.fn(), getRing: () => ring };
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    rotator = new LlmRotatorService(
      prisma as never,
      vault as never,
      logger as never,
    );
  });

  it('uses a different key for every call, in ring order', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 7; i++)
      ids.push((await rotator.acquire(new Set()))!.id);
    expect(ids).toEqual(['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k1']);
  });

  it('skips every key of an account in cooldown', async () => {
    cooled = ['A2'];
    const ids: string[] = [];
    for (let i = 0; i < 3; i++)
      ids.push((await rotator.acquire(new Set()))!.id);
    expect(ids).toEqual(['k1', 'k3', 'k3']);
  });

  it('skips revoked keys and accounts already tried for this request', async () => {
    revoked = ['k1'];
    expect((await rotator.acquire(new Set(['A2'])))!.id).toBe('k3');
  });

  it('returns null when no key is usable', async () => {
    cooled = ['A1', 'A2', 'A3'];
    expect(await rotator.acquire(new Set())).toBeNull();
  });
});
