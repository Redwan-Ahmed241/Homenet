import { APIConnectionTimeoutError, APIError } from 'groq-sdk';
import { LlmClientService } from './llm-client.service.js';
import { AppException } from '../../../common/errors/app.exception.js';
import { AI_ERRORS } from '../../../common/errors/error-codes.js';
import type { ChatJsonOptions, KeyLease } from './llm.types.js';

type CallResult = { json: object; headers?: Record<string, string> } | Error;

function lease(id: string, accountId: string, result: CallResult): KeyLease {
  const create = jest.fn(() => ({
    withResponse: () =>
      result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve({
            data: {
              choices: [{ message: { content: JSON.stringify(result.json) } }],
            },
            response: { headers: new Headers(result.headers ?? {}) },
          }),
  }));
  return {
    id,
    alias: id,
    accountId,
    maskedKey: 'gsk_...0000',
    client: { chat: { completions: { create } } } as never,
  };
}

function httpError(
  status: number,
  headers: Record<string, string> = {},
): APIError {
  return APIError.generate(
    status,
    { error: { message: `status ${status}` } },
    undefined,
    new Headers(headers),
  );
}

const options: ChatJsonOptions = {
  label: 'test',
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: 'hi' }],
  timeoutMs: 5000,
  maxTokens: 50,
  temperature: 0,
};

describe('LlmClientService', () => {
  let leases: Array<KeyLease | null>;
  let rotator: {
    acquire: jest.Mock;
    cooldownAccount: jest.Mock;
    revokeKey: jest.Mock;
  };
  let metrics: { recordSuccess: jest.Mock; recordFailure: jest.Mock };
  let client: LlmClientService;

  beforeEach(() => {
    leases = [];
    rotator = {
      acquire: jest.fn(() => Promise.resolve(leases.shift() ?? null)),
      cooldownAccount: jest.fn(),
      revokeKey: jest.fn(),
    };
    metrics = { recordSuccess: jest.fn(), recordFailure: jest.fn() };
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    client = new LlmClientService(
      rotator as never,
      metrics as never,
      logger as never,
    );
  });

  it('returns parsed JSON and records the success', async () => {
    leases = [lease('k1', 'A1', { json: { ok: true } })];
    await expect(client.chatJson(options)).resolves.toEqual({ ok: true });
    expect(metrics.recordSuccess).toHaveBeenCalledWith('k1');
    expect(rotator.cooldownAccount).not.toHaveBeenCalled();
  });

  it('on 429 cools the whole account down and fails over to another account', async () => {
    leases = [
      lease('k2', 'A2', httpError(429, { 'retry-after': '42' })),
      lease('k3', 'A3', { json: { ok: 1 } }),
    ];
    await expect(client.chatJson(options)).resolves.toEqual({ ok: 1 });
    expect(rotator.cooldownAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'A2' }),
      42,
      'HTTP 429',
    );
    expect(rotator.acquire).toHaveBeenCalledTimes(2);
    expect(metrics.recordFailure).toHaveBeenCalledWith(
      'k2',
      expect.stringContaining('429'),
    );
  });

  it('defaults the 429 cooldown to 60 seconds without retry-after', async () => {
    leases = [
      lease('k1', 'A1', httpError(429)),
      lease('k2', 'A2', { json: {} }),
    ];
    await client.chatJson(options);
    expect(rotator.cooldownAccount).toHaveBeenCalledWith(
      expect.anything(),
      60,
      'HTTP 429',
    );
  });

  it('revokes only the key on 401/403 and fails over', async () => {
    leases = [
      lease('k1', 'A1', httpError(401)),
      lease('k2', 'A2', { json: { ok: 2 } }),
    ];
    await expect(client.chatJson(options)).resolves.toEqual({ ok: 2 });
    expect(rotator.revokeKey).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'k1' }),
      'HTTP 401',
    );
    expect(rotator.cooldownAccount).not.toHaveBeenCalled();
  });

  it('applies the soft limit when 2 or fewer requests remain', async () => {
    leases = [
      lease('k1', 'A1', {
        json: { ok: true },
        headers: {
          'x-ratelimit-remaining-requests': '2',
          'x-ratelimit-reset-requests': '1m26s',
        },
      }),
    ];
    await client.chatJson(options);
    expect(rotator.cooldownAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'A1' }),
      86,
      expect.stringContaining('soft limit'),
    );
  });

  it('retries timeouts without cooling the account down', async () => {
    leases = [
      lease('k1', 'A1', new APIConnectionTimeoutError()),
      lease('k2', 'A2', { json: { ok: 3 } }),
    ];
    await expect(client.chatJson(options)).resolves.toEqual({ ok: 3 });
    expect(rotator.cooldownAccount).not.toHaveBeenCalled();
  });

  it('throws 503 after 3 failed attempts', async () => {
    leases = [
      lease('k1', 'A1', httpError(429)),
      lease('k2', 'A2', httpError(429)),
      lease('k3', 'A3', httpError(429)),
      lease('k4', 'A4', { json: {} }),
    ];
    const error = await client.chatJson(options).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(503);
    expect(rotator.acquire).toHaveBeenCalledTimes(3);
  });

  it('throws 503 when no key is available', async () => {
    const error = await client.chatJson(options).catch((e: unknown) => e);
    expect((error as AppException).errorCode).toBe(
      AI_ERRORS.AI_SERVICE_UNAVAILABLE.code,
    );
  });

  it('does not retry a request the provider rejects as invalid', async () => {
    leases = [
      lease('k1', 'A1', httpError(400)),
      lease('k2', 'A2', { json: {} }),
    ];
    const error = await client.chatJson(options).catch((e: unknown) => e);
    expect((error as AppException).errorCode).toBe(
      AI_ERRORS.AI_REQUEST_FAILED.code,
    );
    expect(rotator.acquire).toHaveBeenCalledTimes(1);
  });
});
