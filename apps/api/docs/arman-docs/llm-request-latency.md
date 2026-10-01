# Smart Search & Smart Listing: Request Flow and Latency

Measured on 2026-09-30 against the real stack: local NestJS server → Neon PostgreSQL (`ap-southeast-1`) → Groq.

- Search model: `openai/gpt-oss-20b`
- Listing model: `openai/gpt-oss-120b`
- `LLM_REASONING_EFFORT=low`

All numbers are wall-clock times for single requests, taken from a local machine. On Vercel, database times should be much lower (see [What the numbers mean](#what-the-numbers-mean)).

---

## Summary

| Request | Typical total | Biggest cost |
|---|---|---|
| Smart search, new query, results found | **~1.75 s** | 2 Groq calls (~1.2 s) |
| Smart search, new query, no results | **~1.3 s** | 1 Groq call (~0.7 s) |
| Smart search, same query within 10 min | **~120 ms** | 1 Neon query batch |
| Smart listing | **~2.0–2.6 s** | 1 Groq call (1.7–2.4 s) |

- **Groq is 60–90% of the time.**
- **Neon costs ~50–100 ms per round trip** from a local machine.
- **API key encryption adds nothing per request** (see [Key encryption cost](#key-encryption-cost)).

---

## Smart search: `POST /v1/properties/smart-search`

```
Client
  │
  ▼
HTTP layer (routing, JwtAuthGuard @Public skip, PermissionsGuard skip,
            ThrottlerGuard, ValidationPipe, ResponseInterceptor)
  │
  ▼
SmartSearchService.search
  ├─ 1. cache.getOrSet(filters)          ── hit? skip step 2
  ├─ 2. LLM call: sentence → filters     (LlmClientService.chatJson)
  │      ├─ rotator.acquire → Neon: nextval + cooldowns + revoked + fingerprint
  │      ├─ vault.ensureFresh             (in memory)
  │      ├─ GroqLlmProvider.chatJson      → Groq API
  │      └─ applySoftLimit + metrics      (metrics written in background)
  ├─ 3. Neon: find verified listings     (ids + count, then cards with area + cover image)
  └─ 4. LLM call: "why it matches" badges (skipped when no listings found)
         └─ same sub-steps as step 2
```

### Measured timings (new query, results found)

| # | Stage | Time |
|---|---|---|
| — | HTTP layer (routing, guards, validation, response wrapper) | ~4 ms |
| 1 | Cache lookup for filters (miss) | < 1 ms |
| 2 | **LLM call: extract filters** | **~690 ms** |
|   | ↳ Neon: rotation state read | 55–105 ms |
|   | ↳ Key-set fingerprint check (in memory) | 0.00 ms |
|   | ↳ **Groq request** | **~635 ms** |
|   | ↳ Rate-limit header check + queue metrics write | < 0.5 ms |
| 3 | **Neon: find verified listings** | **~410 ms** |
| 4 | **LLM call: badges** | **~640 ms** |
|   | ↳ Neon: rotation state read | ~104 ms |
|   | ↳ Groq request | ~534 ms |
|   | **Total** | **~1.75 s** |

### Other cases

| Case | Total | Why |
|---|---|---|
| Same query again within 10 minutes | ~118 ms | Filters come from the in-memory cache; only step 3 runs (~104 ms) |
| New query, no matching listings | ~1.32 s | Step 4 (badges) is skipped |

---

## Smart listing: `POST /v1/properties/smart-listing`

```
Client
  │
  ▼
HTTP layer (JwtAuthGuard verifies token in memory, no DB; ThrottlerGuard;
            ValidationPipe; ResponseInterceptor)
  │
  ▼
SmartListingService.generateListing
  ├─ 1. Neon: area exists?
  ├─ 2. Neon: average price per sqft of comparable verified listings
  └─ 3. LLM call: bilingual copy + price summary
         ├─ rotator.acquire → Neon rotation state read
         ├─ vault.ensureFresh (in memory)
         ├─ GroqLlmProvider.chatJson → Groq API
         └─ applySoftLimit + metrics (background)
```

### Measured timings

| # | Stage | Time |
|---|---|---|
| — | HTTP layer | ~2–6 ms |
| 1 | Neon: check area exists | ~100 ms |
| 2 | Neon: price-per-sqft stats | ~102 ms |
| 3 | Neon: rotation state read | 52–102 ms |
|   | **Groq request** (English + Bengali copy) | **1.7–2.4 s** |
|   | Rate-limit header check + queue metrics write | < 0.5 ms |
|   | **Total** | **~2.0–2.6 s** |

---

## Key encryption cost

API keys are stored AES-256-GCM encrypted in `llm_api_keys`. **Nothing is decrypted per request.**

`LlmKeyVaultService` decrypts every key once at startup (`onModuleInit`). It decrypts again only when the key set changes, for example after `npm run seed:llm-keys`. It detects that by comparing a fingerprint of the key set, which the rotator reads on every call anyway. Decrypted keys and their Groq clients stay in memory.

| Operation | When | Cost |
|---|---|---|
| Decrypt one key | Startup or key-set change | ~40 µs |
| Create one Groq client | Startup or key-set change | ~5 µs |
| Whole pool (3 keys / 50 keys) | Startup or key-set change | ~0.15 ms / ~2 ms |
| Key-set fingerprint check | Every LLM call | ~0.00 ms (string compare) |
| `scrubSecrets` (hide keys in error text) | Only on failures | ~0.2 µs |
| Memory for the pool | Always | a few KB |

---

## What the numbers mean

1. **Groq dominates.** The listing call is slowest because the 120B model writes two long descriptions. With reasoning models, `LLM_REASONING_EFFORT` also affects speed: `low` is fastest.
2. **Neon latency is network distance, not query cost.**
   - A bare `SELECT 1` takes the same ~100 ms from a local machine.
   - The listing search (~410 ms) is several round trips, because Prisma loads the `area` and `media` relations in separate queries.
   - On Vercel deployed in the same region as Neon (`ap-southeast-1`), each round trip should be a few milliseconds. This was not measured.
3. **The rotation state read costs one Neon round trip per LLM call.** This is the price of sharing key rotation and cooldowns across all Vercel instances.
4. **The rest is negligible:** NestJS layer, cache, guards, rate-limit checks and metrics (written in the background via `waitUntil`).

## Possible optimisations (not implemented)

| Idea | Saves | Trade-off |
|---|---|---|
| Deploy Vercel functions in the same region as Neon | Most DB time (~100 ms per round trip locally) | None |
| Make the badge step optional, or return listings first and load badges in a second request | ~640 ms on search | Frontend change |
| Load search cards with one raw SQL join instead of Prisma relations | ~200–300 ms locally | More hand-written SQL |

---

## How this was measured

A scratch script (not committed) imported the compiled app from `dist/` and wrapped these methods with timers before bootstrapping:

- `SmartSearchService`
- `SmartListingService`
- `LlmClientService`
- `LlmRotatorService`
- `LlmKeyVaultService`
- `LlmMetricsService`
- `GroqLlmProvider`
- `CacheService`

It then sent real HTTP requests to the running server. Project code was not changed.

To repeat it, wrap the same methods with `performance.now()`, import `dist/src/main.js`, and call the endpoints.

Groq times vary from run to run with model load and output length, so expect ±30%.
