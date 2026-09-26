import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingType, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { LoggerService } from '../../common/logger/logger.service.js';
import type { ICacheService } from '../../common/cache/cache.service.interface.js';
import { AppException } from '../../common/errors/app.exception.js';
import { AI_ERRORS, AREA_ERRORS } from '../../common/errors/error-codes.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { LlmClientService } from './llm/llm-client.service.js';
import {
  AMENITY_KEYS,
  escapeLikePattern,
  sanitizeSearchFilters,
  sanitizeUserText,
  toAmenityTags,
  type SearchFilters,
} from './ai-filters.util.js';
import {
  LISTING_COPY_PROMPT,
  SEARCH_BADGES_PROMPT,
  SEARCH_FILTERS_PROMPT,
} from './ai.prompts.js';
import { AiSearchDto } from './dto/ai-search.dto.js';
import { AiListingGenerateDto } from './dto/ai-listing-generate.dto.js';

const FILTER_CACHE_TTL_MS = 600_000;
const MAX_BADGES = 3;
const MAX_BADGE_LENGTH = 40;
// Values that mean "the listing does NOT have this amenity" in the free-form amenities JSON.
const FALSY_AMENITY_SQL = Prisma.sql`('false'::jsonb, 'null'::jsonb, '""'::jsonb, '"no"'::jsonb, '0'::jsonb)`;

const SEARCH_CARD_SELECT = {
  id: true,
  title: true,
  type: true,
  subtype: true,
  listing_type: true,
  price: true,
  price_currency: true,
  area_size: true,
  area_unit: true,
  address: true,
  amenities: true,
  is_verified: true,
  published_at: true,
  area: { select: { id: true, name: true, city: true } },
  media: {
    where: { media_type: 'image' as const },
    orderBy: { display_order: 'asc' as const },
    take: 1,
    select: { id: true, url: true, thumbnail_url: true },
  },
} satisfies Prisma.PropertySelect;

type SearchCard = Prisma.PropertyGetPayload<{
  select: typeof SEARCH_CARD_SELECT;
}>;

@Injectable()
export class AiService {
  private readonly searchModel: string;
  private readonly listingModel: string;
  private readonly searchTimeoutMs: number;
  private readonly listingTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClientService,
    private readonly logger: LoggerService,
    @Inject('ICacheService') private readonly cache: ICacheService,
    config: ConfigService,
  ) {
    this.searchModel = config.get<string>(
      'LLM_SEARCH_MODEL',
      'llama-3.1-8b-instant',
    );
    this.listingModel = config.get<string>(
      'LLM_LISTING_MODEL',
      'llama-3.3-70b-versatile',
    );
    this.searchTimeoutMs = Number(config.get('LLM_SEARCH_TIMEOUT_MS', 8000));
    this.listingTimeoutMs = Number(config.get('LLM_LISTING_TIMEOUT_MS', 20000));
  }

  // ── AI Smart Search ─────────────────────────────────────

  async search(dto: AiSearchDto) {
    const query = sanitizeUserText(dto.query, 300);
    if (query.length < 3) throw new AppException(AI_ERRORS.AI_QUERY_TOO_SHORT);

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;

    const filters = await this.extractFilters(query);
    const { cards, total } = await this.findVerifiedListings(
      filters,
      page,
      limit,
    );
    const badges =
      cards.length > 0
        ? await this.generateBadges(query, cards)
        : new Map<string, string[]>();

    return {
      query,
      filters,
      listings: cards.map((card) => ({
        ...card,
        ai_badges: badges.get(card.id) ?? [],
      })),
      pagination: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  // Only the query → filters step is cached; listings are always read live from the database.
  private extractFilters(query: string): Promise<SearchFilters> {
    const cacheKey = this.cache.generateKey(
      'ai:search:filters',
      createHash('sha256').update(query.toLowerCase()).digest('hex'),
    );

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const raw = await this.llm.chatJson({
          label: 'search-filters',
          model: this.searchModel,
          messages: [
            { role: 'system', content: SEARCH_FILTERS_PROMPT },
            { role: 'user', content: `<<<${query}>>>` },
          ],
          timeoutMs: this.searchTimeoutMs,
          maxTokens: 300,
          temperature: 0,
        });
        return sanitizeSearchFilters(raw);
      },
      FILTER_CACHE_TTL_MS,
    );
  }

  private async findVerifiedListings(
    filters: SearchFilters,
    page: number,
    limit: number,
  ) {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.status = 'active'`,
      Prisma.sql`p.is_verified = true`,
      // The database enum can hold values the Prisma client doesn't know (e.g. 'short_let'); those rows would crash findMany.
      Prisma.sql`p.listing_type::text IN (${Prisma.join(Object.values(ListingType))})`,
    ];

    if (filters.area) {
      conditions.push(
        Prisma.sql`a.name ILIKE ${`%${escapeLikePattern(filters.area)}%`}`,
      );
    }
    if (filters.listing_type)
      conditions.push(
        Prisma.sql`p.listing_type::text = ${filters.listing_type}`,
      );
    if (filters.type)
      conditions.push(Prisma.sql`p.type::text = ${filters.type}`);
    if (filters.min_price !== null)
      conditions.push(Prisma.sql`p.price >= ${filters.min_price}`);
    if (filters.max_price !== null)
      conditions.push(Prisma.sql`p.price <= ${filters.max_price}`);
    if (filters.bedrooms !== null)
      conditions.push(this.amenityCountAtLeast('bedrooms', filters.bedrooms));
    if (filters.bathrooms !== null)
      conditions.push(this.amenityCountAtLeast('bathrooms', filters.bathrooms));
    for (const amenity of filters.amenities) {
      const anyKeyPresent = AMENITY_KEYS[amenity].map(
        (key) =>
          Prisma.sql`(p.amenities -> ${key}) NOT IN ${FALSY_AMENITY_SQL}`,
      );
      conditions.push(Prisma.sql`(${Prisma.join(anyKeyPresent, ' OR ')})`);
    }

    const fromWhere = Prisma.sql`
      FROM "Property" p
      JOIN "Area" a ON a.id = p.area_id
      WHERE ${Prisma.join(conditions, ' AND ')}`;

    const [idRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id ${fromWhere}
        ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.prisma.$queryRaw<
        { total: number }[]
      >`SELECT COUNT(*)::int AS total ${fromWhere}`,
    ]);

    const ids = idRows.map((row) => row.id);
    const found = ids.length
      ? await this.prisma.property.findMany({
          where: { id: { in: ids } },
          select: SEARCH_CARD_SELECT,
        })
      : [];
    const byId = new Map(found.map((card) => [card.id, card]));

    return {
      cards: ids
        .map((id) => byId.get(id))
        .filter((card): card is SearchCard => card !== undefined),
      total: countRows[0]?.total ?? 0,
    };
  }

  // Missing or non-numeric values evaluate to NULL, so those listings are excluded rather than erroring.
  private amenityCountAtLeast(key: string, min: number): Prisma.Sql {
    return Prisma.sql`(CASE
      WHEN jsonb_typeof(p.amenities -> ${key}) = 'number' THEN (p.amenities ->> ${key})::numeric
      WHEN (p.amenities ->> ${key}) ~ '^[0-9]+([.][0-9]+)?$' THEN (p.amenities ->> ${key})::numeric
    END) >= ${min}`;
  }

  /** One LLM call for the whole page. Badges are optional: on failure the listings are still returned. */
  private async generateBadges(
    query: string,
    cards: SearchCard[],
  ): Promise<Map<string, string[]>> {
    const listings = cards.map((card) => ({
      id: card.id,
      title: card.title,
      type: card.type,
      listing_type: card.listing_type,
      price_bdt: card.price,
      area: card.area.name,
      size: card.area_size
        ? `${card.area_size} ${card.area_unit ?? 'sqft'}`
        : null,
      amenities: card.amenities,
    }));

    try {
      const raw = await this.llm.chatJson({
        label: 'search-badges',
        model: this.searchModel,
        messages: [
          { role: 'system', content: SEARCH_BADGES_PROMPT },
          {
            role: 'user',
            content: `Request: <<<${query}>>>\nListings: ${JSON.stringify(listings)}`,
          },
        ],
        timeoutMs: this.searchTimeoutMs,
        maxTokens: 900,
        temperature: 0.3,
      });
      return this.parseBadges(raw, new Set(cards.map((card) => card.id)));
    } catch (error) {
      this.logger.warn(
        `Returning search results without badges: ${(error as Error).message}`,
        {
          fileName: 'ai.service.ts',
          functionName: 'generateBadges',
          lineNumber: 264,
        },
      );
      return new Map();
    }
  }

  private parseBadges(
    raw: Record<string, unknown>,
    validIds: Set<string>,
  ): Map<string, string[]> {
    const badges = new Map<string, string[]>();
    if (!Array.isArray(raw.results)) return badges;

    for (const entry of raw.results as Array<Record<string, unknown>>) {
      if (
        typeof entry?.id !== 'string' ||
        !validIds.has(entry.id) ||
        !Array.isArray(entry.badges)
      )
        continue;
      const clean = entry.badges
        .filter(
          (badge): badge is string =>
            typeof badge === 'string' && badge.trim().length > 0,
        )
        .map((badge) => badge.trim().slice(0, MAX_BADGE_LENGTH))
        .slice(0, MAX_BADGES);
      badges.set(entry.id, clean);
    }
    return badges;
  }

  // ── AI Listing Generator ────────────────────────────────

  async generateListing(dto: AiListingGenerateDto, user: AuthenticatedUser) {
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
        fileName: 'ai.service.ts',
        functionName: 'generateListing',
        lineNumber: 325,
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
      maxTokens: 3000,
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
  private async analysePricePerSqft(dto: AiListingGenerateDto) {
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

  private requiredText(value: unknown, maxLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new AppException(AI_ERRORS.AI_INVALID_RESPONSE);
    }
    return value.trim().slice(0, maxLength);
  }
}
