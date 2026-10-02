import { Module } from '@nestjs/common';
import { LlmModule } from '../../../infrastructure/llm/llm.module.js';
import { SmartListingController } from './smart-listing.controller.js';
import { SmartListingService } from './smart-listing.service.js';

@Module({
  imports: [LlmModule],
  controllers: [SmartListingController],
  providers: [SmartListingService],
})
export class SmartListingModule {}
