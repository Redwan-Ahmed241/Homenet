import { Module } from '@nestjs/common';
import { LlmModule } from '../../../infrastructure/llm/llm.module.js';
import { SmartSearchController } from './smart-search.controller.js';
import { SmartSearchService } from './smart-search.service.js';

@Module({
  imports: [LlmModule],
  controllers: [SmartSearchController],
  providers: [SmartSearchService],
})
export class SmartSearchModule {}
