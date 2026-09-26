import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import {
  KEY_SET_FINGERPRINT_SQL,
  LlmKeyVaultService,
} from './llm-key-vault.service.js';
import { pickSlotIndex } from './llm-rotation.util.js';
import {
  LLM_KEY_STATUS,
  type KeyLease,
  type SharedRotationState,
} from './llm.types.js';

/**
 * Strict 1-call round-robin shared by every Vercel instance: the position comes from a Postgres
 * sequence and cooldown/revocation state lives in llm_api_keys, never in instance memory.
 */
@Injectable()
export class LlmRotatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: LlmKeyVaultService,
    private readonly logger: LoggerService,
  ) {}

  async acquire(
    excludedAccounts: ReadonlySet<string>,
  ): Promise<KeyLease | null> {
    const state = await this.readSharedState();
    if (!state) return null;

    await this.vault.ensureFresh(state.fingerprint);
    const ring = this.vault.getRing();

    const index = pickSlotIndex(ring.length, state.counter - 1, (i) => {
      const key = ring[i];
      return (
        key.client !== null &&
        !state.revokedKeyIds.has(key.id) &&
        !state.cooledAccounts.has(key.accountId) &&
        !excludedAccounts.has(key.accountId)
      );
    });
    if (index === null) return null;

    const key = ring[index];
    return { ...key, client: key.client! };
  }

  /** Awaited so other instances skip the account from their very next call. */
  async cooldownAccount(
    lease: KeyLease,
    seconds: number,
    reason: string,
  ): Promise<void> {
    const until = new Date(Date.now() + seconds * 1000);
    try {
      await this.prisma.$executeRaw`
        UPDATE llm_api_keys
        SET status = ${LLM_KEY_STATUS.COOLDOWN},
            cooldown_until = GREATEST(COALESCE(cooldown_until, NOW()), ${until}),
            updated_at = NOW()
        WHERE account_id = ${lease.accountId} AND status <> ${LLM_KEY_STATUS.REVOKED}`;
      this.logger.warn(
        `Account ${lease.accountId} cooling down for ${seconds}s (${reason}, key ${lease.alias})`,
        {
          fileName: 'llm-rotator.service.ts',
          functionName: 'cooldownAccount',
          lineNumber: 71,
        },
      );
    } catch (error) {
      this.logError(
        'cooldownAccount',
        `Failed to record cooldown for ${lease.accountId}`,
        error,
      );
    }
  }

  async revokeKey(lease: KeyLease, reason: string): Promise<void> {
    try {
      await this.prisma.llmApiKey.update({
        where: { id: lease.id },
        data: { status: LLM_KEY_STATUS.REVOKED },
      });
      this.logger.error(
        `LLM key ${lease.alias} (${lease.maskedKey}) revoked: ${reason}. Needs admin review.`,
        {
          fileName: 'llm-rotator.service.ts',
          functionName: 'revokeKey',
          lineNumber: 94,
        },
      );
    } catch (error) {
      this.logError('revokeKey', `Failed to revoke ${lease.alias}`, error);
    }
  }

  private async readSharedState(): Promise<SharedRotationState | null> {
    try {
      const [row] = await this.prisma.$queryRaw<
        {
          counter: bigint;
          cooled_accounts: string[];
          revoked_key_ids: string[];
          fingerprint: string;
        }[]
      >`
        SELECT
          nextval('llm_rotation_seq') AS counter,
          COALESCE((SELECT array_agg(DISTINCT account_id) FROM llm_api_keys WHERE cooldown_until > NOW()), '{}') AS cooled_accounts,
          COALESCE((SELECT array_agg(id::text) FROM llm_api_keys WHERE status = ${LLM_KEY_STATUS.REVOKED}), '{}') AS revoked_key_ids,
          (${Prisma.raw(KEY_SET_FINGERPRINT_SQL)}) AS fingerprint`;

      return {
        counter: Number(row.counter),
        cooledAccounts: new Set(row.cooled_accounts),
        revokedKeyIds: new Set(row.revoked_key_ids),
        fingerprint: row.fingerprint,
      };
    } catch (error) {
      this.logError(
        'readSharedState',
        'Could not read shared rotation state',
        error,
      );
      return null;
    }
  }

  private logError(
    functionName: string,
    message: string,
    error: unknown,
  ): void {
    this.logger.error(`${message}: ${(error as Error).message}`, {
      fileName: 'llm-rotator.service.ts',
      functionName,
      lineNumber: 142,
    });
  }
}
