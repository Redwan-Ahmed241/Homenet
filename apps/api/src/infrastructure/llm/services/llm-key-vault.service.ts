import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { LlmCryptoService } from './llm-crypto.service.js';
import { buildInterleavedRing } from '../utils/llm-rotation.util.js';
import { LLM_PROVIDER } from '../llm.constants.js';
import type { ILlmProvider } from '../interfaces/llm-provider.interface.js';
import type { LlmProviderClient, VaultKey } from '../llm.types.js';

/** Changes whenever a key row is added, removed, moved to another account or re-encrypted. */
export const KEY_SET_FINGERPRINT_SQL = `
  SELECT md5(COALESCE(string_agg(id::text || ':' || account_id || ':' || auth_tag, ',' ORDER BY id), ''))
  FROM llm_api_keys`;

/** Holds the decrypted key pool in memory; decrypted keys never leave this process. */
@Injectable()
export class LlmKeyVaultService implements OnModuleInit {
  private ring: VaultKey[] = [];
  private fingerprint: string | null = null;
  private loading: Promise<void> | null = null;

  /** Connects encrypted key storage, decryption and logging for the in-memory vault. */
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: LlmCryptoService,
    private readonly logger: LoggerService,
    @Inject(LLM_PROVIDER) private readonly provider: ILlmProvider,
  ) {}

  /** Loads the key pool when the NestJS module initializes. */
  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /** Returns the current interleaved key ring, including entries whose client could not be created. */
  getRing(): readonly VaultKey[] {
    return this.ring;
  }

  /** Warm instances reload when the seed script has changed the key set since they booted. */
  async ensureFresh(currentFingerprint: string): Promise<void> {
    if (currentFingerprint !== this.fingerprint) {
      await this.reload();
    }
  }

  /** Coalesces concurrent reload requests into one load and clears the pending promise when it settles. */
  private reload(): Promise<void> {
    this.loading ??= this.load().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** Loads the fingerprint and encrypted rows, rebuilds the key ring and logs load failures. */
  private async load(): Promise<void> {
    if (!this.crypto.isConfigured()) return;

    try {
      const [fingerprintRows, rows] = await Promise.all([
        this.prisma.$queryRawUnsafe<{ md5: string }[]>(KEY_SET_FINGERPRINT_SQL),
        this.prisma.llmApiKey.findMany({
          select: {
            id: true,
            key_alias: true,
            account_id: true,
            masked_key: true,
            encrypted_key: true,
            iv: true,
            auth_tag: true,
          },
        }),
      ]);

      this.ring = buildInterleavedRing(rows).map((row) => ({
        id: row.id,
        alias: row.key_alias,
        accountId: row.account_id,
        maskedKey: row.masked_key,
        client: this.createClient(row),
      }));
      this.fingerprint = fingerprintRows[0]?.md5 ?? null;

      const usable = this.ring.filter((key) => key.client).length;
      const accounts = new Set(this.ring.map((key) => key.accountId)).size;
      this.logger.info(
        `LLM key vault loaded ${usable}/${this.ring.length} keys across ${accounts} accounts`,
        {
          fileName: 'llm-key-vault.service.ts',
          functionName: 'load',
          lineNumber: 86,
        },
      );
    } catch (error) {
      this.logger.error(
        `Could not load LLM keys from llm_api_keys: ${(error as Error).message}`,
        {
          fileName: 'llm-key-vault.service.ts',
          functionName: 'load',
          lineNumber: 95,
        },
      );
    }
  }

  /** Creates a provider client with SDK retries disabled, or logs and returns null if key loading fails. */
  private createClient(row: {
    key_alias: string;
    encrypted_key: string;
    iv: string;
    auth_tag: string;
  }): LlmProviderClient | null {
    try {
      const apiKey = this.crypto.decrypt(row, row.key_alias);
      return this.provider.createClient(apiKey);
    } catch {
      this.logger.error(
        `Refusing to load LLM key "${row.key_alias}": decryption or integrity check failed`,
        {
          fileName: 'llm-key-vault.service.ts',
          functionName: 'createClient',
          lineNumber: 117,
        },
      );
      return null;
    }
  }
}
