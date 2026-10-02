import { Module } from '@nestjs/common';
import { LLM_PROVIDER } from './llm.constants.js';
import { GroqLlmProvider } from './providers/groq-llm.provider.js';
import { LlmCryptoService } from './services/llm-crypto.service.js';
import { LlmKeyVaultService } from './services/llm-key-vault.service.js';
import { LlmRotatorService } from './services/llm-rotator.service.js';
import { LlmMetricsService } from './services/llm-metrics.service.js';
import { LlmClientService } from './services/llm-client.service.js';

@Module({
  providers: [
    // Swap this binding to move to another LLM vendor; key rotation stays the same.
    { provide: LLM_PROVIDER, useClass: GroqLlmProvider },
    LlmCryptoService,
    LlmKeyVaultService,
    LlmRotatorService,
    LlmMetricsService,
    LlmClientService,
  ],
  exports: [LlmClientService],
})
export class LlmModule {}
