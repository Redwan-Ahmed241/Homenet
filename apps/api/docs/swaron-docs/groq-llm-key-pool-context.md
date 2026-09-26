# Groq LLM Key Pool & AI Endpoints — Full Context

Handoff document for any AI agent or developer continuing this work. It records **what was built, why, every decision the team made, how it was verified, and what must not be broken.** No secrets are stored here.

- **Status:** Implemented and tested locally against Neon. **Not committed yet.** Real Groq keys not yet provided (50 dummy keys are seeded).
- **Scope:** Backend only (`Homenet/apps/api`). Frontend (Expo + Next.js) was deliberately **not** touched.
- **Team note:** The team describes itself as beginners. Explain things in plain language, with short flow diagrams or analogies, and ask before big decisions.

---

## 1. Why this exists

Previously the frontend called LLM APIs directly for "AI Search" and "AI Listing". Problems:

1. **API keys leaked** in client bundles and network traffic.
2. **HTTP 429 rate limits**: one free-tier key is exhausted quickly.
3. **~50 keys** owned by the team with no way to spread traffic across them.
4. **Hallucinations**: the LLM had no access to real, verified listings in PostgreSQL.

**Solution:** All LLM calls move to the NestJS backend, which holds the keys (encrypted at rest), rotates them strictly one call per key, applies a circuit breaker on rate limits, grounds results in the database, and records per-key telemetry.

---

## 2. Decisions made with the team (authoritative)

| # | Topic | Decision |
|---|---|---|
| 1 | Provider | **Groq** (OpenAI-compatible, `https://api.groq.com/openai/v1`), via `groq-sdk`. |
| 2 | Models | Configurable by env. `LLM_SEARCH_MODEL="llama-3.1-8b-instant"`, `LLM_LISTING_MODEL="llama-3.3-70b-versatile"`. |
| 3 | Keys & accounts | ~50 keys from **~10 separate Groq accounts** (4–5 keys each). Groq limits are **per account/org**, not per key, so the table has an `account_id` column. |
| 4 | Rotation | **Strict 1-request round-robin: every individual LLM call uses the next key** (required by the team's senior). AI Search makes 2 calls → uses 2 different keys. |
| 5 | Rotation order | Interleave accounts: `A1-k1 → A2-k1 → … → A10-k1 → A1-k2 → …`. Accounts with fewer keys simply wrap. |
| 6 | 429 / soft limit | 429 **or** `x-ratelimit-remaining-requests ≤ 2` → the **whole account** cools down. Retry immediately on a key from a **different** account. |
| 7 | 401 / 403 | Revoke **only that key** (`status = 'REVOKED'`), permanently, flagged for admin review. |
| 8 | Retries | Max 3 attempts per LLM call, each on a different account. |
| 9 | Cooldown length | 429 → `retry-after` header (seconds). Soft limit → parse `x-ratelimit-reset-requests` (e.g. `1m26s` → 86s). Fallback **60s**. |
| 10 | All keys unavailable | HTTP **503**, message `"AI service is experiencing high demand. Please try again in a few moments."`, header `Retry-After: 30`. |
| 11 | Deployment | **Vercel (serverless)**. Therefore rotation state is **shared in Neon**, not in memory (see §4). |
| 12 | Caching | Cache **only** the query → extracted-filters step (10 min). Listings are always read live from the DB. |
| 13 | Search results | Default top 10, optional `page` and `limit`. Badges for the whole page in **one** LLM call. Area match = case-insensitive substring on `Area.name`. |
| 14 | Price per sqft | Computed from **real verified active listings** in the DB, passed to the LLM. Never invented by the LLM. |
| 15 | Seeding | One-off CLI script reading a git-ignored `keys.json`, encrypting, and **upserting** by alias. |
| 16 | Schema changes | **No Prisma migrations.** Manual DDL only. The team allowed the agent to create the table itself, which was done. |
| 17 | Admin tooling | None for now. Keys are managed or re-enabled via SQL in the Neon console. |

---

## 3. High-level architecture

```
Client (web / mobile)                       ── never sees any LLM key
   │  POST /v1/ai/search            (public, throttled 20/min)
   │  POST /v1/ai/generate-listing  (JWT, throttled 20/min)
   ▼
AiController ──► AiService
                   │  1. validate + sanitize input
                   │  2. LlmClientService.chatJson(...)   ◄── one call = one key
                   │  3. Prisma / raw SQL against Neon (grounding)
                   ▼
LlmClientService ── retry loop (max 3, different accounts, 25s budget)
   │  acquire key ──► LlmRotatorService ──► Neon: nextval('llm_rotation_seq')
   │                                              + cooled accounts + revoked keys
   │                                              + key-set fingerprint
   │                      └─► LlmKeyVaultService (decrypted Groq clients in RAM)
   │  on result ──► LlmMetricsService (async telemetry, Vercel waitUntil)
   │  on 429/soft limit ──► rotator.cooldownAccount (awaited DB write)
   │  on 401/403 ──► rotator.revokeKey (awaited DB write)
   ▼
Groq API
```

---

## 4. Why state lives in Neon (the Vercel problem), explained simply

Vercel runs **several copies** of the backend at once and restarts them at will. If each copy kept its own counter in memory, two copies would both use Key 1, and every restart would begin at Key 1 again.

**Fix: one shared "ticket machine" in the database.** It works like a bank's single ticket dispenser:

```
Copy 1 ──► Neon: nextval('llm_rotation_seq') ──► 1 ──► Key 1
Copy 2 ──► Neon: nextval('llm_rotation_seq') ──► 2 ──► Key 2
Copy 3 ──► Neon: nextval('llm_rotation_seq') ──► 3 ──► Key 3
```

- A Postgres **SEQUENCE** never hands out the same number twice, even under concurrency, and never locks rows.
- **Cooldowns are a shared notice board:** `cooldown_until` in `llm_api_keys`. When one copy sees a 429, it writes the cooldown (awaited), and every other copy skips that account on its next call.
- The in-memory part is only the **decrypted keys** (the "vault"). Each copy builds the **same deterministic ring order**, so counter N means the same key everywhere.
- Cost: one small query per LLM call (a few ms).

**Known minor imperfection:** if the counter lands on an ineligible key (cooled or revoked), the rotator walks forward to the next eligible one. The next caller might land on that same key. This only happens while accounts are cooling down, and is accepted.

---

## 5. Database (Neon PostgreSQL)

### 5.1 DDL, already applied to Neon

Stored in `prisma/manual-sql/001_llm_api_keys.sql` (idempotent, safe to re-run). It was applied with:

```
npx prisma db execute --schema prisma/schema.prisma --file prisma/manual-sql/001_llm_api_keys.sql
```

```sql
CREATE TABLE IF NOT EXISTS llm_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_alias VARCHAR(50) UNIQUE NOT NULL,       -- e.g. 'llm-key-01'
    account_id VARCHAR(50) NOT NULL,             -- e.g. 'acct-01' (Groq account/org)
    masked_key VARCHAR(20) NOT NULL,             -- e.g. 'gsk_...9a4b'
    encrypted_key TEXT NOT NULL,                 -- AES-256-GCM ciphertext (hex)
    iv VARCHAR(32) NOT NULL,                     -- 12-byte IV (24 hex chars)
    auth_tag VARCHAR(40) NOT NULL,               -- 16-byte tag (32 hex chars)
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE | COOLDOWN | REVOKED
    success_count INT DEFAULT 0 NOT NULL,
    failure_count INT DEFAULT 0 NOT NULL,
    last_success_at TIMESTAMPTZ,
    last_failed_at TIMESTAMPTZ,
    last_error TEXT,
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_keys_status   ON llm_api_keys(status);
CREATE INDEX IF NOT EXISTS idx_llm_keys_cooldown ON llm_api_keys(cooldown_until);
CREATE INDEX IF NOT EXISTS idx_llm_keys_account  ON llm_api_keys(account_id);
CREATE SEQUENCE IF NOT EXISTS llm_rotation_seq;
```

### 5.2 Prisma model

`LlmApiKey` is in `prisma/schema.prisma`, `@@map("llm_api_keys")`. It uses native types (`@db.Uuid`, `@db.VarChar(n)`, `@db.Timestamptz(6)`) and named indexes, so it **exactly matches** the live table. This was verified with a read-only `prisma migrate diff`, which showed no differences for this table. Only `prisma generate` was run.

### 5.3 Semantics

- **`cooldown_until` is authoritative** for cooldowns. `status = 'COOLDOWN'` is a label for humans. A key flips back to `ACTIVE` on its next success after the cooldown expires.
- **`REVOKED` is permanent** until a human changes it. To re-enable: `UPDATE llm_api_keys SET status='ACTIVE' WHERE key_alias='llm-key-07';`
- **Telemetry** (`success_count`, `failure_count`, `last_*`) is written asynchronously.

---

## 6. Security

- **AES-256-GCM** envelope encryption:
  - **Master key:** `LLM_MASTER_ENCRYPTION_KEY`, 64 hex chars / 32 bytes, stored only in `.env` or Vercel env.
  - **IV:** unique random 12-byte IV per record.
  - **Auth tag:** 16-byte tag. Tampering with ciphertext, IV or tag makes decryption throw, and the vault **refuses to load that key** (it logs an error and keeps its ring slot, marked unusable).
- **Alias bound as AAD:** a ciphertext copied onto another row fails to decrypt. **Consequence:** renaming a `key_alias` directly in SQL breaks that key. Re-seed instead.
- **Plaintext keys** exist only in server RAM (Groq client objects inside `LlmKeyVaultService`).
- **Masking:**
  - `maskKey()` → `gsk_...xxxx`.
  - `scrubSecrets()` replaces `gsk_[A-Za-z0-9]{8,}` with `gsk_***` in `last_error`.
  - The global `LoggerService` format applies the same regex to **every** log line.
- **Prompt-injection defence:**
  - Control characters and our delimiters (`<<<`, `>>>`, ```` ``` ````) are stripped from user text, and length is capped.
  - User text is wrapped in `<<< >>>`, and system prompts say it is data, not instructions.
  - JSON mode (`response_format: json_object`).
  - All model output is **whitelist-validated** before use: enums, numbers, amenity tags and length caps.
- **SQL injection:** all raw SQL uses Prisma tagged templates (parameterised). `LIKE` wildcards in the area name are escaped. Verified: area `x%' OR 1=1 --` returns 0 results.

---

## 7. Rotation & circuit-breaker behaviour (`LlmClientService.chatJson`)

Constants:

| Constant | Value |
|---|---|
| Max attempts | 3 |
| Soft limit | `remaining-requests ≤ 2` |
| Default cooldown | 60s |
| Total time budget | 25,000 ms (Vercel `maxDuration` is 30s) |
| Minimum time left to start an attempt | 2,000 ms |

For each attempt: `rotator.acquire(triedAccounts)` → Groq call with `maxRetries: 0` and a per-call timeout → react to the result:

| Groq result | Action | Retry? |
|---|---|---|
| Success | `recordSuccess`. If `x-ratelimit-remaining-requests ≤ 2`, cool the account down for the `x-ratelimit-reset-requests` duration (awaited). | — |
| 429 | `recordFailure`, cool the **account** down for `retry-after` s (default 60, awaited) | Yes, next account |
| 401 / 403 | `recordFailure`, **revoke key** (awaited) | Yes, next account |
| Timeout, network error, 5xx, 498 | `recordFailure`, no cooldown | Yes, next account |
| Other 4xx (e.g. 400) | `recordFailure` → `AI_REQUEST_FAILED` (502) | No |
| Non-JSON content | `AI_INVALID_RESPONSE` (502) | No |
| No usable key, or 3 attempts used, or budget spent | `AI_SERVICE_UNAVAILABLE` (503) + `Retry-After: 30` | — |

Note: Groq's `x-ratelimit-*-requests` headers refer to **requests per day**, and the token headers to tokens per minute. Token-per-minute limits are only handled when an actual 429 occurs.

**Rotator details (`LlmRotatorService`):**
- One query per `acquire()` returns:
  - `nextval('llm_rotation_seq')`
  - accounts with `cooldown_until > NOW()`
  - revoked key ids
  - a **key-set fingerprint** (`md5` over `id:account_id:auth_tag`)
- Index = `(counter − 1) mod ringSize`, then walk forward to the first key that is usable, not revoked, not in a cooled account, and not in an account already tried for this request.
- If the fingerprint differs from what the vault loaded, the vault **reloads first**. So after re-seeding, warm Vercel instances never call Groq with stale or dummy keys, which would otherwise wrongly revoke a newly seeded real key.
- Cooldown SQL uses `GREATEST(...)`, so a shorter cooldown never overwrites a longer one.
- If the DB is unreachable or the table is missing, `acquire` returns null → 503.

**Vault (`LlmKeyVaultService`):**
- Loads **all** rows (including revoked ones) and builds the deterministic interleaved ring, so ring positions match across instances.
- If `LLM_MASTER_ENCRYPTION_KEY` is missing or invalid, the AI endpoints return 503. The rest of the API still boots.

---

## 8. Endpoints

All responses are wrapped by the global `ResponseInterceptor`: `{ success, message, data }`. Errors: `{ success:false, message, error_code, data:null }`.

### 8.1 `POST /v1/ai/search` — public (`@Public()`), `@Throttle 20/min`

Request (`AiSearchDto`): `{ query: string (3–300), page?: int 1–100 (default 1), limit?: int 1–20 (default 10) }`

Flow:
1. **Sanitize the query.** If it's shorter than 3 characters afterwards → `AI_QUERY_TOO_SHORT` (400).
2. **Filters (LLM call #1, search model, temperature 0, max 300 tokens).** Cached via `ICacheService.getOrSet`, key `ai:search:filters:<sha256(lowercased query)>`, TTL `600_000` **ms** (this cache uses milliseconds). The output is whitelist-validated into:
   `{ area, listing_type: sale|rent|null, type: residential|commercial|land|parking|null, min_price, max_price, bedrooms, bathrooms, amenities[] }`
   (lakh = 100,000; crore = 10,000,000; BDT).
3. **DB query.** Raw SQL returns ids plus the total count (parallel), then Prisma `findMany` fetches card fields, re-ordered to the SQL order. Conditions:
   - always `status='active' AND is_verified=true AND listing_type IN ('sale','rent')`
   - `Area.name ILIKE %area%`
   - price range
   - `amenities` JSON `bedrooms`/`bathrooms` ≥ N (numeric or numeric string; missing → excluded)
   - each amenity present and not a falsy value (`false`, `null`, `""`, `"no"`, `0`)
   - order `published_at DESC NULLS LAST, created_at DESC`
4. **Badges (LLM call #2, search model, temperature 0.3, max 900 tokens)**, one call for the whole page: 1–3 badges of ≤ 40 chars per listing id. Skipped when there are no results. **If it fails, listings are still returned without badges.**

Response `data`:
```json
{
  "query": "...",
  "filters": { "area": "Gulshan", "listing_type": "sale", "type": "residential", "min_price": null,
               "max_price": 35000000, "bedrooms": 3, "bathrooms": null, "amenities": ["parking"] },
  "listings": [ { "id": "...", "title": "...", "type": "...", "subtype": null, "listing_type": "sale",
                  "price": 0, "price_currency": "BDT", "area_size": 0, "area_unit": "sqft", "address": "...",
                  "amenities": {}, "is_verified": true, "published_at": "...",
                  "area": { "id": "...", "name": "...", "city": "..." },
                  "media": [ { "id": "...", "url": "...", "thumbnail_url": "..." } ],
                  "ai_badges": ["3 beds as requested"] } ],
  "pagination": { "total": 2, "page": 1, "limit": 10, "total_pages": 1 }
}
```

**Amenity vocabulary** (from `PROPERTY_TYPES_SPECIFICATION.md` §5) and the JSON keys each tag may appear under in real data:
- `parking`, `lift`, `generator`, `security`, `gym`, `rooftop`, `loading_dock`, `cctv`, `road_access`, `electricity`, `covered`, `ev_charging`
- `gas` → `gas` | `gas_connection`
- `pool` → `pool` | `swimming_pool`
- `water` → `water` | `water_supply`

Seed data stores values like `parking: 'covered'` (a string), and parking-space **counts are not stored**. So "2 parking spaces" can only be treated as "has parking".

### 8.2 `POST /v1/ai/generate-listing` — JWT required, `@Throttle 20/min`

Request (`AiListingGenerateDto`):

| Field | Type | Rules |
|---|---|---|
| `area_id` | string | required, max 100 |
| `type` | `PropertyType` | required |
| `listing_type` | `ListingType` | required |
| `price` | number | BDT, ≥ 1 |
| `area_size` | number | sqft, 1–10,000,000 |
| `bedrooms` | int | optional, 0–50 |
| `bathrooms` | int | optional, 0–50 |
| `notes` | string | optional, ≤ 1000 |

Flow:
1. Area must exist, else `AREA_NOT_FOUND` (1400, 404).
2. **Price analysis (raw SQL):** `AVG(price/area_size)` and `COUNT(*)` over active, verified listings with the **same `area_id`, `listing_type` and `type`**, `area_size > 0`, unit sqft. The backend computes `your_price_per_sqft` and `diff_pct` itself.
3. **LLM call (listing model, temperature 0.6, max 3000 tokens, 20s timeout).** It receives the facts JSON and sanitized notes in `<<< >>>`.
4. **Validation:** `headline` (≤ 120), `description_en` (≤ 4000) and `description_bn` (≤ 6000) are required, else `AI_INVALID_RESPONSE`. `amenity_tags` are filtered to the whitelist. `price_summary` is capped at 600.

Response `data`:
```json
{
  "headline": "...", "description_en": "...", "description_bn": "...", "amenity_tags": ["lift","generator"],
  "price_analysis": { "your_price_per_sqft": 14583, "area_avg_price_per_sqft": 13200,
                      "sample_size": 4, "diff_pct": 10.5, "summary": "..." }
}
```

### 8.3 Error codes (range 1600–1699, `src/common/errors/codes/ai.errors.ts`)

| Code | Key | HTTP |
|---|---|---|
| 1600 | `AI_SERVICE_UNAVAILABLE` | 503 (+ `Retry-After: 30` via `AiRetryAfterInterceptor`) |
| 1601 | `AI_INVALID_RESPONSE` | 502 |
| 1602 | `AI_REQUEST_FAILED` | 502 |
| 1603 | `AI_QUERY_TOO_SHORT` | 400 |

---

## 9. File map (all under `Homenet/apps/api`)

**New**
```
prisma/manual-sql/001_llm_api_keys.sql            manual DDL (table, indexes, sequence)
scripts/seed-llm-keys.ts                          encrypt + upsert keys from keys.json
src/common/errors/codes/ai.errors.ts              AI_ERRORS (1600–1603)
src/modules/ai/
  ai.module.ts                                    registers controller + 6 providers
  ai.controller.ts                                routes, @Public, @Throttle, Swagger, interceptor
  ai.service.ts                                   search + listing flows, SQL grounding, badge parsing
  ai.prompts.ts                                   3 system prompts (filters, badges, listing copy)
  ai-filters.util.ts                              amenity vocab, sanitizeUserText, filter whitelist
  dto/ai-search.dto.ts, dto/ai-listing-generate.dto.ts
  interceptors/ai-retry-after.interceptor.ts      adds Retry-After: 30 on 1600
  llm/llm.types.ts                                VaultKey, KeyLease, ChatJsonOptions, statuses
  llm/llm-crypto.util.ts                          AES-256-GCM, maskKey, scrubSecrets (no local imports!)
  llm/llm-crypto.service.ts                       master key from ConfigService
  llm/llm-key-vault.service.ts                    decrypted ring, fingerprint reload
  llm/llm-rotation.util.ts                        interleaved ring, slot picking, duration parser
  llm/llm-rotator.service.ts                      shared counter/cooldown/revoke (Neon)
  llm/llm-metrics.service.ts                      async telemetry via @vercel/functions waitUntil
  llm/llm-client.service.ts                       retry loop + circuit breaker
  llm/*.spec.ts                                   38 unit tests (4 suites)
docs/swaron-docs/groq-llm-key-pool-context.md     this file
docs/swaron-docs/frontend-integration-guide/07-ai-module.md   frontend guide for both AI endpoints
```

**Docs updated:** `docs/swaron-docs/api-testing-guide.md`. Added section 7 (AI Search, AI Listing Generator, rotation/circuit-breaker testing), error codes 1600–1603, testing-flow steps 21–23 and an AI seeding note. The file uses CRLF line endings; keep them.

**Doc correction found:** the global `JwtAuthGuard` throws Nest's default `UnauthorizedException`, so a missing or expired JWT actually returns `message: "Unauthorized"` with `error_code: 1100`, not `1106` as older module guides state. The new AI docs use the real values.

**Modified**
```
prisma/schema.prisma            + LlmApiKey model
src/app.module.ts               + AiModule import
src/common/errors/error-codes.ts + AI_ERRORS export
src/common/logger/logger.service.ts  masks gsk_ keys in every log line
package.json                    + groq-sdk ^1.6.0, @vercel/functions ^3.9.9, "seed:llm-keys" script
.env.example                    + LLM_* variables (documented)
.gitignore                      + keys.json, *.keys.json
../../package-lock.json         (monorepo root lockfile)
```

**Local only (git-ignored, never commit):** `.env` (now contains a generated `LLM_MASTER_ENCRYPTION_KEY`) and `keys.json` (50 dummy keys).

---

## 10. Configuration

| Variable | Default | Notes |
|---|---|---|
| `LLM_MASTER_ENCRYPTION_KEY` | — | 64 hex chars. **Must be identical** locally and on Vercel. If lost, keys must be re-seeded. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `LLM_SEARCH_MODEL` | `llama-3.1-8b-instant` | filters + badges |
| `LLM_LISTING_MODEL` | `llama-3.3-70b-versatile` | bilingual listing copy |
| `LLM_SEARCH_TIMEOUT_MS` | `8000` | per attempt |
| `LLM_LISTING_TIMEOUT_MS` | `20000` | per attempt, capped by the 25s total budget |

Existing infrastructure reused:
- `PrismaService`, `LoggerService` and `ICacheService` are global. The logger always takes `{ fileName, functionName, lineNumber }`.
- `AppException` + `ErrorDefinition` (numeric codes).
- Global `JwtAuthGuard` (bypassed with `@Public()`), `ThrottlerGuard` and `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`).
- Imports use `.js` extensions. TS module is `nodenext`, and the package has no `"type":"module"`, so the output is CommonJS.

---

## 11. Runbook

```bash
cd Homenet/apps/api

# Seed / update keys (reads ./keys.json; upsert by alias; verifies decryption round-trip)
npm run seed:llm-keys
npm run seed:llm-keys -- other.keys.json     # custom file
npm run seed:llm-keys -- --prune             # also DELETE rows whose alias is not in the file

# Tests / checks
npx jest src/modules/ai
npx tsc --noEmit -p tsconfig.json
npx eslint src/modules/ai scripts/seed-llm-keys.ts
npx nest build
```

`keys.json` format:
```json
[{ "alias": "llm-key-01", "account_id": "acct-01", "key": "gsk_..." }]
```

Seed behaviour:
- Unchanged key → skipped.
- New or changed key → re-encrypted with a fresh IV, and `status` reset to `ACTIVE`, `cooldown_until` / `last_error` cleared.
- Account-only change → status kept.

**Useful Neon SQL**
```sql
-- Pool overview
SELECT key_alias, account_id, status, success_count, failure_count, last_error, cooldown_until
FROM llm_api_keys ORDER BY account_id, key_alias;

-- Re-enable a revoked key
UPDATE llm_api_keys SET status='ACTIVE' WHERE key_alias='llm-key-07';

-- Full reset of telemetry + restart rotation (used after local testing)
UPDATE llm_api_keys SET status='ACTIVE', success_count=0, failure_count=0, last_success_at=NULL,
  last_failed_at=NULL, last_error=NULL, cooldown_until=NULL, updated_at=NOW();
ALTER SEQUENCE llm_rotation_seq RESTART WITH 1;
```

**Swapping dummy keys for real keys:** replace `keys.json` with the real entries and run `npm run seed:llm-keys` (add `-- --prune` if the real set has fewer than 50 aliases). Warm Vercel instances detect the new key set through the fingerprint and reload automatically.

---

## 12. Verification performed (local, against live Neon)

1. **Rotation, one key per call:** requests used `llm-key-01 (acct-01) → llm-key-06 (acct-02) → llm-key-11 (acct-03)`, one account per attempt.
2. **Shared across instances:** two API processes (ports 3055 and 3056) continued **one** sequence: instance B used keys 16/21/26 right after A's 1/6/11, then A used 31/36/41. After a full round it wrapped to round 2 (`llm-key-46 → llm-key-02 → llm-key-07`), skipping the revoked `llm-key-01`.
3. **Revocation:** Groq returned 401 for the dummy keys, and each was marked `REVOKED` with `failure_count=1`, `last_failed_at` set and `last_error` = `401: ... Invalid API Key`.
4. **Graceful failure:** the client received `503`, `Retry-After: 30`, `error_code 1600` and the agreed message.
5. **Listing endpoint:** unknown area → 1400/404, bad body → 400 validation errors, no JWT → 401. The price-analysis SQL executed successfully.
6. **Search SQL on real listings (LLM stubbed):** area substring (`gulshan` → Gulshan-1, Gulshan-2), bedrooms ≥ N, parking stored as the string `'covered'`/`'yes'`, `pool` matching `swimming_pool`, max price, and an injection-style area → 0 rows.
7. **Seed:** 50 created, re-run → 50 unchanged (idempotent). A full dump of the table contained no plaintext key. Logs contained 0 plaintext keys.
8. **Quality gates:** 38/38 new unit tests pass; `tsc`, `eslint` (new files) and `nest build` are clean.
9. **After testing,** telemetry was reset and the sequence restarted, so Neon holds 50 clean `ACTIVE` dummy keys.

Unit tests cover:
- crypto round-trip, unique IV, tampered ciphertext/tag, wrong alias, wrong master key
- ring interleaving, slot walking, duration parsing
- rotation order, cooled-account skip, revoked skip
- 429 → account cooldown + failover
- default 60s cooldown
- 401 → revoke
- soft limit (`remaining=2`, `1m26s` → 86s)
- timeout retry without cooldown
- 503 after 3 attempts or with no keys
- 400 → no retry

---

## 13. Known issues & pitfalls (read before changing anything)

1. **Never run `prisma migrate dev` / `migrate reset` against Neon.** `llm_api_keys` is not in `prisma/migrations`, so Prisma sees drift and offers to **reset (wipe) the database**. Schema changes to this table go into a new file under `prisma/manual-sql/` and are applied manually.
2. **Pre-existing enum drift:** the Neon `ListingType` enum has a value `short_let` (1 listing) that is not in `schema.prisma` or the code. Prisma crashes when it reads such a row. AI search therefore restricts results to `listing_type IN ('sale','rent')`. Other existing endpoints may hit the same crash. Not fixed; the team should decide whether to add `short_let` to the schema.
3. **Vercel env:** `LLM_MASTER_ENCRYPTION_KEY` (identical to the local one used for seeding) and the `LLM_*` variables must be added in Vercel, or AI endpoints return 503.
4. **Per-instance on Vercel (accepted):** the filter cache and the existing `ThrottlerGuard` storage are in-memory per instance. Rotation and cooldowns are **not**; they are shared in Neon.
5. **Telemetry on Vercel** uses `waitUntil` from `@vercel/functions`. Outside Vercel it is a no-op and the write still runs.
6. **Renaming `key_alias` in SQL breaks decryption** of that key (alias is AAD). Re-seed instead.
7. **3 pre-existing failing test suites,** unrelated to this work: `verification.service.spec.ts`, `prototype-background-task.service.spec.ts` and `test/modules/auth/auth.service.spec.ts`. They fail on Nest test-module dependency setup.
8. **Logger `lineNumber` values are hard-coded** (project convention). They were synced after formatting; they drift if code above them changes.
9. **`llm-crypto.util.ts` must keep zero local imports.** The seed script loads it through `ts-node` (CommonJS) with an extensionless import.

---

## 14. Open items / next steps

- [ ] The team provides the real keys and account ids → replace `keys.json` → `npm run seed:llm-keys -- --prune`.
- [ ] Add the `LLM_*` env vars to Vercel.
- [ ] The team verifies the table and telemetry in Neon.
- [ ] Commit on a feature branch and open a PR (not done; waiting for the team).
- [ ] Optional: add codes 1600–1603 to `docs/swaron-docs/error-codes.md`.
- [ ] Later phase: move the frontend AI features to call `/v1/ai/search` and `/v1/ai/generate-listing`, and remove the client-side LLM keys and calls.
- [ ] Optional: decide on the `short_let` enum drift (§13.2).

---

## 15. Rules for any agent continuing this work

- Do **not** touch the frontend unless the team asks.
- Do **not** run Prisma migrations against Neon. Use manual SQL and ask first.
- Do **not** log, print, commit or document plaintext keys or the master key. `keys.json` and `.env` stay git-ignored.
- Keep **strict one-key-per-LLM-call rotation** and the account-level cooldown semantics. They are explicit team requirements.
- Keep every raw SQL query parameterised (Prisma tagged templates).
- Follow the codebase conventions: `.js` import extensions, `AppException` + numeric `ErrorDefinition`, logger metadata `{ fileName, functionName, lineNumber }`, `@Public()` for public routes.
- Explain decisions to the team in plain language with simple diagrams, and confirm before destructive or shared-state actions.
