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
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { AiService } from './ai.service.js';
import { AiSearchDto } from './dto/ai-search.dto.js';
import { AiListingGenerateDto } from './dto/ai-listing-generate.dto.js';
import { AiRetryAfterInterceptor } from './interceptors/ai-retry-after.interceptor.js';

@ApiTags('AI')
@Controller('v1/ai')
@Throttle({ default: { limit: 20, ttl: 60000 } })
@UseInterceptors(AiRetryAfterInterceptor)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Natural-language property search over verified active listings',
  })
  search(@Body() dto: AiSearchDto) {
    return this.aiService.search(dto);
  }

  @Post('generate-listing')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate bilingual listing copy and a grounded price-per-sqft analysis',
  })
  generateListing(
    @Body() dto: AiListingGenerateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aiService.generateListing(dto, user);
  }
}
