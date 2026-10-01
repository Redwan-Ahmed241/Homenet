# AI refactor: Prisma migration, LLM infrastructure, property smart features

## Context
The `llm_api_keys` table was created by a manual SQL file (`prisma/manual-sql/001_llm_api_keys.sql`) outside Prisma's migration history. The AI code lives in a standalone `src/modules/ai` module with Groq hard-wired. Goals: proper Prisma migration, a vendor-agnostic LLM layer in `src/infrastructure/llm`, and the two features moved under the property module.

Decisions (from user): DB already has the manual SQL applied; routes move under `/v1/properties/...`; keep Groq; only the "send request" adapter is vendor-specific; smart features are sub-modules imported by PropertyModule.

## 1. Migration
- New `prisma/migrations/20260930000001_add_llm_api_keys/migration.sql` in Prisma's generated style (`CREATE TABLE "llm_api_keys"`, indexes `idx_llm_keys_*`, unique on `key_alias`) — generate via `prisma migrate diff --from-migrations ... --to-schema-datamodel` to match schema exactly, then append `CREATE SEQUENCE "llm_rotation_seq";` (not expressible in schema; same hand-edit approach as trigger migrations).
- Delete `prisma/manual-sql/` entirely; update references (`docs/swaron-docs/*`, seed script comments).
- Existing DBs: run `npx prisma migrate resolve --applied 20260930000001_add_llm_api_keys` once; document this in the docs. Fresh DBs: `migrate deploy` works normally. Verify `prisma migrate diff` shows no drift.

## Naming & scope rules
- Infrastructure: everything `llm-*` / `Llm*`. Features: `smart-search-*` / `smart-listing-*`. No `ai` names remain.
- Minimal change: move existing files mostly as-is; the only new abstraction is one provider interface + one Groq adapter. No extra layers.

## 2. `src/infrastructure/llm/` (pattern of notification/background-task)
```
llm/
  llm.constants.ts             LLM_PROVIDER token
  llm.module.ts                exports LlmClientService
  llm.types.ts                 (moved)
  interfaces/llm-provider.interface.ts   ILlmProvider: createClient(apiKey), chatJson(client, req, opts), getErrorInfo(err)
  providers/groq-llm.provider.ts         the only file importing groq-sdk
  services/ llm-client, llm-key-vault, llm-rotator, llm-metrics, llm-crypto (moved, + specs)
  utils/ llm-crypto.util, llm-rotation.util (moved, + specs)
  interceptors/llm-retry-after.interceptor.ts  (renamed from ai-retry-after)
```
- Rotation, circuit breaker, key vault, metrics stay shared. Switching vendor = new provider class + change `{ provide: LLM_PROVIDER, useClass: ... }`.

## 3. Property sub-modules
- `src/modules/property/smart-searching/` — `smart-search.module.ts`, `smart-search.controller.ts` (`POST /v1/properties/smart-search`), `smart-search.service.ts`, `dto/smart-search.dto.ts`, `smart-search-filters.util.ts`, `smart-search.prompt.ts`.
- `src/modules/property/smart-listing/` — `smart-listing.module.ts`, `smart-listing.controller.ts` (`POST /v1/properties/smart-listing`), `smart-listing.service.ts`, `dto/smart-listing.dto.ts`, `smart-listing.prompt.ts`.
- `ai.service.ts` split between the two services (no shared leftover unless genuinely shared).
- Both import `LlmModule`; `PropertyModule` imports both. Register controllers so `/smart-*` routes aren't shadowed by `/:id` (static POST paths don't collide with `POST /:id/...`, but check).
- Delete `src/modules/ai/`, remove `AiModule` from `app.module.ts`.
- Update `scripts/seed-llm-keys.ts` imports, `AGENTS.md` (tokens table, endpoints, infrastructure list), `api-testing-guide.md` routes.

## 3b. Exact details (so any implementer gets it right)
- Groq touchpoints to move behind `ILlmProvider` (only these):
  - `llm-key-vault.service.ts` `createClient()` → `new Groq({ apiKey, maxRetries: 0 })`
  - `llm-client.service.ts` `chatJson()` → `client.chat.completions.create({model, messages, temperature, max_completion_tokens, response_format:{type:'json_object'}}, {timeout, maxRetries:0}).withResponse()` → provider returns `{ data, headers }`
  - `llm-client.service.ts` `handleFailure()` → `error instanceof APIError`, `error.status`, `error.headers.get('retry-after')` → provider `getErrorInfo(err): { status?: number; retryAfter?: string | null }`. The 429 / 401-403 / 5xx-498 decision logic itself stays in `LlmClientService`.
  - `llm.types.ts` `client: Groq` → `client: unknown` (opaque, owned by provider)
  - `llm-crypto.util.ts` `gsk_` redaction pattern stays as-is (harmless; a new vendor adds its pattern).
- Controllers keep: `@Throttle({ default: { limit: 20, ttl: 60000 } })`, `LlmRetryAfterInterceptor`, `@HttpCode(200)`, search `@Public()`, listing JWT + `@CurrentUser()`, same Swagger summaries; `@ApiTags('Properties')`; `@Controller('v1/properties')` with routes `smart-search` / `smart-listing`.
- `AiService` split: search() + extractFilters/findVerifiedListings/amenityCountAtLeast/generateBadges/parseBadges → `SmartSearchService`; generateListing/analysePricePerSqft → `SmartListingService`; `requiredText` goes where used (duplicate only if both need it). Same env vars (`LLM_SEARCH_MODEL`, `LLM_LISTING_MODEL`, `LLM_*_TIMEOUT_MS`).
- Error codes: keep `src/common/errors/codes/ai.errors.ts` and the `AI_*` `error_code` strings unchanged — the frontend relies on them (behaviour must be identical).
- `scripts/seed-llm-keys.ts` import → `../src/infrastructure/llm/utils/llm-crypto.util`.
- Migration timestamp must sort after `20260927000001_add_notifications`.
- `dist/` is build output — ignore, it regenerates.

## 4. Behaviour must stay identical
- Pure restructure: prompts, filter parsing/normalization, validation, DTO fields, response shape, error codes, rate limits, retry-after headers, key rotation and circuit-breaker logic are copied unchanged. Only file locations, names, and the two URLs change.
- Before refactor: record real responses from `POST /v1/ai/search` and `POST /v1/ai/generate-listing` for a few sample inputs (plus a forced key-failure case). After refactor: repeat on the new URLs and compare shape/behaviour.
- Existing specs move with their files and must pass unchanged (only import paths edited).

## 5. Docs update
- `docs/swaron-docs/api-testing-guide.md` section 7 (lines ~2154–2472): rename heading to "Smart Property Features (Groq LLM)"; 7.1 → `POST /v1/properties/smart-search`, 7.2 → `POST /v1/properties/smart-listing`, 7.3 key rotation steps updated (no manual-sql; `migrate resolve` note; seed script path). Update Table of Contents links and any `/v1/ai/` mentions elsewhere in the file. Request/response examples stay the same.
- Keep this plan copy in `docs/arman-docs/llm-refactor-plan.md` in sync.

## Verification
- `npx prisma migrate diff` (no drift), `npx prisma generate`, `npm run build`, `npm run lint`, `npm run test` (moved specs pass).
- `npm run start:dev`, hit new routes via Swagger `/api/docs`; confirm old `/v1/ai/*` gone; run key rotation test steps from the testing guide.
