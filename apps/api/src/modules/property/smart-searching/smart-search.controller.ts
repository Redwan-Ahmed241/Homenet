import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { LlmRetryAfterInterceptor } from '../../../infrastructure/llm/interceptors/llm-retry-after.interceptor.js';
import { SmartSearchService } from './smart-search.service.js';
import { SmartSearchDto } from './dto/smart-search.dto.js';

@ApiTags('Properties')
@Controller('v1/properties')
@Throttle({ default: { limit: 20, ttl: 60000 } })
@UseInterceptors(LlmRetryAfterInterceptor)
export class SmartSearchController {
  /** Connects the smart search route to its service. */
  constructor(private readonly smartSearchService: SmartSearchService) {}

  /** Handles public natural-language searches for active, verified property listings. */
  @Public()
  @Post('smart-search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Natural-language property search over verified active listings',
  })
  search(@Body() dto: SmartSearchDto) {
    return this.smartSearchService.search(dto);
  }
}
