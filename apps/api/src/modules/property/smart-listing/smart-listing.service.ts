import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { AppException } from '../../../common/errors/app.exception.js';
import { AI_ERRORS, AREA_ERRORS } from '../../../common/errors/error-codes.js';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator.js';
import { LlmClientService } from '../../../infrastructure/llm/services/llm-client.service.js';
import {
  parseReasoningEffort,
  type LlmReasoningEffort,
} from '../../../infrastructure/llm/llm.types.js';
import {
  sanitizeUserText,
  toAmenityTags,
} from '../smart-searching/smart-search-filters.util.js';
import { LISTING_COPY_PROMPT } from './smart-listing.prompt.js';
import { SmartListingDto } from './dto/smart-listing.dto.js';

@Injectable()
export class SmartListingService {
  private readonly listingModel: string;
  private readonly listingTimeoutMs: number;
  private readonly reasoningEffort: LlmReasoningEffort | undefined;

  /** Loads listing model and timeout settings and connects listing dependencies. */
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClientService,
    private readonly logger: LoggerService,
    config: ConfigService,
  ) {
    this.listingModel = config.get<string>(
      'LLM_LISTING_MODEL',
      'llama-3.3-70b-versatile',
    );
    this.listingTimeoutMs = Number(config.get('LLM_LISTING_TIMEOUT_MS', 20000));
    this.reasoningEffort = parseReasoningEffort(
      config.get<string>('LLM_REASONING_EFFORT'),
    );
  }

  /** Validates the area and generates bilingual copy, supported amenity tags and database-derived price comparisons. */
  async generateListing(dto: SmartListingDto, user: AuthenticatedUser) {
    const area = await this.prisma.area.findUnique({
      where: { id: dto.area_id },
      select: { name: true, city: true },
    });
    if (!area) throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);

    const priceAnalysis = await this.analysePricePerSqft(dto);
    const notes = dto.notes ? sanitizeUserText(dto.notes, 1000) : '';
    const facts = {
      area: area.name,
      city: area.city,
      type: dto.type,
      listing_type: dto.listing_type,
      price_bdt: dto.price,
      size_sqft: dto.area_size,
      bedrooms: dto.bedrooms ?? null,
      bathrooms: dto.bathrooms ?? null,
      price_analysis: priceAnalysis,
    };

    this.logger.info(
      `Generating listing copy for user ${user.id} in ${area.name}`,
      {
        fileName: 'smart-listing.service.ts',
        functionName: 'generateListing',
        lineNumber: 65,
      },
    );

    const raw = await this.llm.chatJson({
      label: 'listing-copy',
      model: this.listingModel,
      messages: [
        { role: 'system', content: LISTING_COPY_PROMPT },
        {
          role: 'user',
          content: `Facts: ${JSON.stringify(facts)}\nSeller notes: <<<${notes}>>>`,
        },
      ],
      timeoutMs: this.listingTimeoutMs,
      maxTokens: 6000,
      reasoningEffort: this.reasoningEffort,
      temperature: 0.6,
    });

    const headline = this.requiredText(raw.headline, 120);
    const descriptionEn = this.requiredText(raw.description_en, 4000);
    const descriptionBn = this.requiredText(raw.description_bn, 6000);

    return {
      headline,
      description_en: descriptionEn,
      description_bn: descriptionBn,
      amenity_tags: toAmenityTags(raw.amenity_tags),
      price_analysis: {
        ...priceAnalysis,
        summary:
          typeof raw.price_summary === 'string'
            ? raw.price_summary.trim().slice(0, 600)
            : '',
      },
    };
  }

  /** Grounded in real verified listings of the same area, listing type and property type. */
  private async analysePricePerSqft(dto: SmartListingDto) {
    const [stats] = await this.prisma.$queryRaw<
      { avg_ppsf: number | null; sample_size: number }[]
    >`
      SELECT AVG(p.price / p.area_size)::float8 AS avg_ppsf, COUNT(*)::int AS sample_size
      FROM "Property" p
      WHERE p.area_id = ${dto.area_id}
        AND p.listing_type::text = ${dto.listing_type}
        AND p.type::text = ${dto.type}
        AND p.status = 'active'
        AND p.is_verified = true
        AND p.area_size > 0
        AND COALESCE(p.area_unit, 'sqft') = 'sqft'`;

    const yourPpsf = Math.round(dto.price / dto.area_size);
    const areaAvg = stats?.avg_ppsf ? Math.round(stats.avg_ppsf) : null;

    return {
      your_price_per_sqft: yourPpsf,
      area_avg_price_per_sqft: areaAvg,
      sample_size: stats?.sample_size ?? 0,
      diff_pct: areaAvg
        ? Math.round(((yourPpsf - areaAvg) / areaAvg) * 1000) / 10
        : null,
    };
  }

  /** Trims and truncates required model text, throwing AI_INVALID_RESPONSE for missing or blank values. */
  private requiredText(value: unknown, maxLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new AppException(AI_ERRORS.AI_INVALID_RESPONSE);
    }
    return value.trim().slice(0, maxLength);
  }
}
