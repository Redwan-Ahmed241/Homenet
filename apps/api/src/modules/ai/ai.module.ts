import { Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { LlmCryptoService } from './llm/llm-crypto.service.js';
import { LlmKeyVaultService } from './llm/llm-key-vault.service.js';
import { LlmRotatorService } from './llm/llm-rotator.service.js';
import { LlmMetricsService } from './llm/llm-metrics.service.js';
import { LlmClientService } from './llm/llm-client.service.js';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    LlmCryptoService,
    LlmKeyVaultService,
    LlmRotatorService,
    LlmMetricsService,
    LlmClientService,
  ],
})
export class AiModule {}
