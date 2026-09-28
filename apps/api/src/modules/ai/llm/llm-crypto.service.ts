import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/logger/logger.service.js';
import {
  decryptSecret,
  parseMasterKey,
  type EncryptedSecret,
} from './llm-crypto.util.js';

@Injectable()
export class LlmCryptoService {
  private readonly masterKey: Buffer | null;

  /** Loads the master encryption key, logging and disabling decryption if configuration is invalid. */
  constructor(config: ConfigService, logger: LoggerService) {
    try {
      this.masterKey = parseMasterKey(
        config.get<string>('LLM_MASTER_ENCRYPTION_KEY'),
      );
    } catch (error) {
      this.masterKey = null;
      logger.error(`AI features disabled: ${(error as Error).message}`, {
        fileName: 'llm-crypto.service.ts',
        functionName: 'constructor',
        lineNumber: 24,
      });
    }
  }

  /** Reports whether a valid master encryption key is available. */
  isConfigured(): boolean {
    return this.masterKey !== null;
  }

  /** Authenticates and decrypts a key using its alias; throws if configuration or authentication fails. */
  decrypt(secret: EncryptedSecret, alias: string): string {
    if (!this.masterKey) {
      throw new Error('LLM_MASTER_ENCRYPTION_KEY is not configured');
    }
    return decryptSecret(secret, alias, this.masterKey);
  }
}
