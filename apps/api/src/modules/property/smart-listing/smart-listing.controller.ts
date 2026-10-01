import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator.js';
import { LlmRetryAfterInterceptor } from '../../../infrastructure/llm/interceptors/llm-retry-after.interceptor.js';
import { SmartListingService } from './smart-listing.service.js';
import { SmartListingDto } from './dto/smart-listing.dto.js';

@ApiTags('Properties')
@Controller('v1/properties')
@Throttle({ default: { limit: 20, ttl: 60000 } })
@UseInterceptors(LlmRetryAfterInterceptor)
export class SmartListingController {
  /** Connects the smart listing route to its service. */
  constructor(private readonly smartListingService: SmartListingService) {}

  /** Generates bilingual listing copy and price analysis for the authenticated caller. */
  @Post('smart-listing')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate bilingual listing copy and a grounded price-per-sqft analysis',
  })
  generateListing(
    @Body() dto: SmartListingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.smartListingService.generateListing(dto, user);
  }
}
