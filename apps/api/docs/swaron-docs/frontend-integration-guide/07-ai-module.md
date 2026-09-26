# AI Module — Frontend Integration Guide

> **Base URL:** `http://localhost:3000/v1/ai`
>
> **Branch:** All work must be done on the **`dev`** branch.
>
> **CORS:** Local server (`main.ts`) allows `localhost:8081`–`8086`, `192.168.68.105:8081`–`8086`, `homenetbd.com` and `homenet-bd.com` (with and without `www`). The Vercel deployment accepts any origin.
>
> **Global Response Format (Success):**
> ```json
> {
>   "success": true,
>   "message": "OK",
>   "data": { ... }
> }
> ```
>
> **Global Response Format (Error):**
> ```json
> {
>   "success": false,
>   "message": "Error description",
>   "error_code": 1600,
>   "data": null
> }
> ```
>
> **Auth:** `POST /search` is public. `POST /generate-listing` requires a JWT (`Authorization: Bearer <access_token>`).
>
> **Rate limit:** 20 requests per 60 seconds per endpoint.

---

## Overview

AI features (**AI Search** and **AI Listing**) now go through the backend. **The frontend must never hold or send an LLM API key.**

```
Before (insecure)                         Now
─────────────────                         ───
App ──(API key in bundle)──► LLM          App ──► HomeNet API ──► Groq LLM
                                                   │  (keys encrypted on server,
                                                   │   rotated on every call)
                                                   └──► PostgreSQL (real, verified listings)
```

What this means for the web (Next.js) and mobile (Expo) apps:

1. **Remove** any LLM SDK usage, direct LLM `fetch` calls and LLM keys / env vars from the frontend code and `.env` files.
2. **Call** `POST /v1/ai/search` and `POST /v1/ai/generate-listing` instead.
3. **Handle `503`** gracefully. It means the AI is busy, not that something is broken (see [Handling errors](#3-handling-errors)).

> The backend keeps 50 keys across ~10 Groq accounts and switches key on every call. If one account is rate-limited, it retries on another account automatically. The user only sees an error if **all 3 attempts** fail.

---

## 1. POST /v1/ai/search

> **Public** — No auth required. Rate limited: 20 requests per 60 seconds.

Natural-language property search. The user types a sentence; the backend:

1. Turns it into filters with the LLM (e.g. area, price, bedrooms, amenities).
2. Searches **only active and verified** listings in the database, so results are real and nothing is invented.
3. Adds up to 3 short "why it matches" badges to each listing.

Understands BDT amounts written as **lakh** (100,000) and **crore** (10,000,000), and partial area names (`"gulshan"` matches `Gulshan-1` and `Gulshan-2`).

### Request Body

```json
{
  "query": "3-bed apartment in Gulshan under 6 crore with parking",
  "page": 1,
  "limit": 10
}
```

| Field   | Type    | Required | Description                         |
|---------|---------|----------|-------------------------------------|
| `query` | string  | Yes      | The user's sentence, 3–300 chars    |
| `page`  | integer | No       | Page number, 1–100 (default `1`)    |
| `limit` | integer | No       | Results per page, 1–20 (default `10`) |

> For "load more", send the **same `query`** with the next `page`. The filter step is cached for 10 minutes, so later pages are fast and consistent.

### Possible Responses

#### ✅ 200 OK — Matching listings

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "query": "3-bed apartment in Gulshan under 6 crore with parking",
    "filters": {
      "area": "Gulshan",
      "listing_type": null,
      "type": "residential",
      "min_price": null,
      "max_price": 60000000,
      "bedrooms": 3,
      "bathrooms": null,
      "amenities": ["parking"]
    },
    "listings": [
      {
        "id": "uuid-of-property",
        "title": "Luxury 5-Bed Apartment in Gulshan-2",
        "type": "residential",
        "subtype": "apartment",
        "listing_type": "sale",
        "price": 58000000,
        "price_currency": "BDT",
        "area_size": 3200,
        "area_unit": "sqft",
        "address": "Road 90, Gulshan-2",
        "amenities": { "bedrooms": 5, "bathrooms": 4, "parking": "covered", "gym": true },
        "is_verified": true,
        "published_at": "2026-08-01T10:00:00.000Z",
        "area": { "id": "gulshan-2-dhaka", "name": "Gulshan-2", "city": "Dhaka" },
        "media": [
          {
            "id": "uuid-of-media",
            "url": "https://res.cloudinary.com/...",
            "thumbnail_url": "https://res.cloudinary.com/..."
          }
        ],
        "ai_badges": ["5 beds, more than asked", "Under budget", "Covered parking"]
      }
    ],
    "pagination": { "total": 2, "page": 1, "limit": 10, "total_pages": 1 }
  }
}
```

#### ✅ 200 OK — No matches

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "query": "castle in Gulshan under 1 lakh",
    "filters": { "area": "Gulshan", "listing_type": null, "type": null, "min_price": null,
                 "max_price": 100000, "bedrooms": null, "bathrooms": null, "amenities": [] },
    "listings": [],
    "pagination": { "total": 0, "page": 1, "limit": 10, "total_pages": 0 }
  }
}
```

**UI notes**

- **Show `filters` as removable chips** ("Gulshan", "≤ 6 Cr", "3+ beds", "Parking") so the user sees how the AI understood them. Fields that are `null` were not applied. To "remove" a chip, re-run the search with a reworded query, or fall back to `GET /v1/properties` with explicit filters.
- **`ai_badges` may be empty.** The backend still returns listings if the badge step fails. Render badges only when present.
- **Card data:**
  - `media` holds **at most one** image (the cover). Fetch `GET /v1/properties/:id` for the full gallery.
  - This card shape is similar to `GET /v1/properties` but has no `user` or `_count`.
- **`bedrooms` / `bathrooms` in filters are minimums** ("3-bed" → 3 or more).

#### ❌ 400 Bad Request — Validation errors

```json
{
  "success": false,
  "message": "query must be longer than or equal to 3 characters",
  "error_code": 1001,
  "data": {
    "errors": ["query must be longer than or equal to 3 characters"]
  }
}
```

#### ❌ 400 Bad Request — Query too short after cleaning

Returned when the text is only symbols or whitespace.

```json
{
  "success": false,
  "message": "Please describe what you are looking for in a few more words.",
  "error_code": 1603,
  "data": null
}
```

#### ❌ 503 Service Unavailable — AI busy

Response header: **`Retry-After: 30`**

```json
{
  "success": false,
  "message": "AI service is experiencing high demand. Please try again in a few moments.",
  "error_code": 1600,
  "data": null
}
```

#### ❌ 502 Bad Gateway — Unexpected AI output

```json
{
  "success": false,
  "message": "The AI service returned an unexpected response. Please try again.",
  "error_code": 1601,
  "data": null
}
```

#### ❌ 429 Too Many Requests — Rate limit exceeded

```json
{
  "success": false,
  "message": "ThrottlerException: Too Many Requests",
  "error_code": 1000,
  "data": null
}
```

---

## 2. POST /v1/ai/generate-listing

> 🔒 **Requires JWT.** Rate limited: 20 requests per 60 seconds.

Fills the seller's listing wizard with AI-written copy: an SEO headline, English and Bengali descriptions, amenity tags, and a price-per-sqft comparison.

The **numbers** in `price_analysis` are calculated by the backend from real verified listings in the same area (same listing type and property type). The AI only writes the `summary` sentence.

### Request Body

```json
{
  "area_id": "gulshan-dhaka",
  "type": "residential",
  "listing_type": "sale",
  "price": 35000000,
  "area_size": 2400,
  "bedrooms": 3,
  "bathrooms": 3,
  "notes": "south facing, 2 car parking, lift, generator, near Gulshan 2 circle"
}
```

| Field          | Type    | Required | Description                                                     |
|----------------|---------|----------|-----------------------------------------------------------------|
| `area_id`      | string  | Yes      | Area id from `GET /v1/areas` (max 100 chars)                     |
| `type`         | enum    | Yes      | `residential`, `commercial`, `land`, `parking`                  |
| `listing_type` | enum    | Yes      | `sale`, `rent`                                                  |
| `price`        | number  | Yes      | Asking price in BDT (≥ 1). For rent, the monthly rent            |
| `area_size`    | number  | Yes      | Size in **sqft** (1 – 10,000,000). Convert katha/bigha/sqm first |
| `bedrooms`     | integer | No       | 0–50                                                            |
| `bathrooms`    | integer | No       | 0–50                                                            |
| `notes`        | string  | No       | Seller's rough notes / bullet points, max 1000 chars            |

> Extra fields are rejected (`property xyz should not exist`), so send only the fields above.

### Possible Responses

#### ✅ 200 OK — Generated copy

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "headline": "Spacious 3-Bed South-Facing Apartment for Sale in Gulshan",
    "description_en": "Discover comfortable city living in this 2,400 sqft south-facing apartment in Gulshan...",
    "description_bn": "গুলশানে ২,৪০০ বর্গফুটের দক্ষিণমুখী এই অ্যাপার্টমেন্টে...",
    "amenity_tags": ["parking", "lift", "generator"],
    "price_analysis": {
      "your_price_per_sqft": 14583,
      "area_avg_price_per_sqft": 13200,
      "sample_size": 4,
      "diff_pct": 10.5,
      "summary": "At 14,583 BDT/sqft, this listing is about 10.5% above the Gulshan average of 13,200 BDT/sqft."
    }
  }
}
```

#### ✅ 200 OK — No comparable listings in the area

```json
{
  "price_analysis": {
    "your_price_per_sqft": 14583,
    "area_avg_price_per_sqft": null,
    "sample_size": 0,
    "diff_pct": null,
    "summary": "There is not enough comparable market data for this area yet."
  }
}
```

**UI notes**

- **Pre-fill, don't auto-save.** Put `headline` into the title field, and `description_en` / `description_bn` into the description fields (use tabs or a language toggle for Bengali). The seller must be able to edit before saving via `POST /v1/properties` or `PATCH /v1/properties/:id`.
- **`amenity_tags`** are platform tag keys (see [Amenity tags](#5-amenity-tags)). Use them to pre-tick amenity chips and write them into the property's `amenities` object as `true`.
- **Price badge:** show `diff_pct` as "10.5% above / below area average". Hide the comparison when `area_avg_price_per_sqft` is `null`. Use `sample_size` to show "based on N listings".
- **Bengali text:** make sure the font supports Bengali (e.g. Noto Sans Bengali, Hind Siliguri), on mobile as well.
- **Latency:** this call uses a larger model and can take several seconds. Show a clear loading state ("Writing your listing…") and disable the button while it runs.

#### ❌ 404 Not Found — Area not found

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

#### ❌ 400 Bad Request — Validation errors

```json
{
  "success": false,
  "message": "type must be one of the following values: residential, commercial, land, parking; price must not be less than 1",
  "error_code": 1001,
  "data": {
    "errors": [
      "type must be one of the following values: residential, commercial, land, parking",
      "price must not be less than 1"
    ]
  }
}
```

#### ❌ 401 Unauthorized — Missing/invalid JWT

```json
{
  "success": false,
  "message": "Unauthorized",
  "error_code": 1100,
  "data": null
}
```

#### ❌ 503 / 502 — AI busy or unexpected output

Same bodies as in section 1: `1600` (503, with `Retry-After: 30`), `1601` (502). In addition, `1602` (502) means "The AI service could not process this request."

---

## 3. Handling Errors

| `error_code` | HTTP | Meaning | Recommended UI |
|---|---|---|---|
| `1600` | 503 | All AI keys are busy or rate-limited right now | Friendly message: *"Our AI is busy, please try again in a moment."* Offer a **Retry** button. Read the `Retry-After` header (seconds) and optionally retry **once** automatically after that delay. |
| `1601` | 502 | The AI returned something unusable | *"Something went wrong, please try again."* One retry is reasonable. |
| `1602` | 502 | The AI provider rejected the request | Generic error. Don't auto-retry. |
| `1603` | 400 | Search text too short or empty after cleaning | Ask the user to type more. |
| `1001` | 400 | Validation error | Show `data.errors` next to the form fields. |
| `1400` | 404 | Unknown `area_id` | Ask the user to pick the area again. |
| `1100` | 401 | JWT missing, expired or invalid (message `"Unauthorized"`) | Refresh the token via `POST /v1/auth/refresh`, then retry. |
| `1000` + HTTP 429 | 429 | Over 20 requests/minute | Debounce the input. Ask the user to wait a moment. |

**Do not:**
- Fire a search on every keystroke. Search on submit, or debounce ≥ 600 ms.
- Auto-retry in a loop. At most **one** automatic retry, honouring `Retry-After`.
- Use a client timeout shorter than **30 seconds**. The backend may take up to about 25 seconds in the worst case (3 attempts).

---

## 4. TypeScript Types & Example Client

```typescript
export type ListingType = 'sale' | 'rent';
export type PropertyType = 'residential' | 'commercial' | 'land' | 'parking';

export interface AiSearchFilters {
  area: string | null;
  listing_type: ListingType | null;
  type: PropertyType | null;
  min_price: number | null;
  max_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: AmenityTag[];
}

export interface AiSearchListing {
  id: string;
  title: string;
  type: PropertyType;
  subtype: string | null;
  listing_type: ListingType;
  price: number;
  price_currency: string;
  area_size: number | null;
  area_unit: string | null;
  address: string | null;
  amenities: Record<string, boolean | number | string> | null;
  is_verified: boolean;
  published_at: string | null;
  area: { id: string; name: string; city: string };
  media: { id: string; url: string; thumbnail_url: string | null }[];
  ai_badges: string[];
}

export interface AiSearchResult {
  query: string;
  filters: AiSearchFilters;
  listings: AiSearchListing[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface AiListingRequest {
  area_id: string;
  type: PropertyType;
  listing_type: ListingType;
  price: number;
  area_size: number; // sqft
  bedrooms?: number;
  bathrooms?: number;
  notes?: string;
}

export interface AiListingResult {
  headline: string;
  description_en: string;
  description_bn: string;
  amenity_tags: AmenityTag[];
  price_analysis: {
    your_price_per_sqft: number;
    area_avg_price_per_sqft: number | null;
    sample_size: number;
    diff_pct: number | null;
    summary: string;
  };
}

export type AmenityTag =
  | 'parking' | 'lift' | 'generator' | 'security' | 'gas' | 'pool' | 'gym' | 'rooftop'
  | 'loading_dock' | 'cctv' | 'road_access' | 'electricity' | 'water' | 'covered' | 'ev_charging';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorCode: number,
    public retryAfterSeconds: number | null,
  ) {
    super(message);
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'; // Expo: EXPO_PUBLIC_API_URL

async function postAi<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/ai/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) {
    const retryAfter = res.headers.get('Retry-After');
    throw new ApiError(json.message, res.status, json.error_code, retryAfter ? Number(retryAfter) : null);
  }
  return json.data as T;
}

export const aiSearch = (query: string, page = 1, limit = 10) =>
  postAi<AiSearchResult>('search', { query, page, limit });

export const aiGenerateListing = (input: AiListingRequest, accessToken: string) =>
  postAi<AiListingResult>('generate-listing', input, accessToken);
```

> **CORS note:** browsers only expose the `Retry-After` header to JavaScript if the API allows it. If `res.headers.get('Retry-After')` returns `null` on the web app, fall back to **30 seconds** (the value the backend always sends). React Native is not affected.

---

## 5. Amenity Tags

The AI uses the platform amenity tags from `PROPERTY_TYPES_SPECIFICATION.md`:

| Tag | Label | Tag | Label |
|---|---|---|---|
| `parking` | Parking Space | `loading_dock` | Loading Bay / Dock |
| `lift` | Elevator | `cctv` | Surveillance Cameras |
| `generator` | Backup Generator | `road_access` | Road Access |
| `security` | 24/7 Security | `electricity` | Grid Power Connection |
| `gas` | Gas Line | `water` | Water Supply |
| `pool` | Swimming Pool | `covered` | Covered / Indoor Slot |
| `gym` | Gym | `ev_charging` | EV Charger |
| `rooftop` | Rooftop Access | | |

> When searching, `pool` also matches older listings stored as `swimming_pool`, `gas` matches `gas_connection`, and `water` matches `water_supply`.

---

## 6. Frontend Integration Checklist

- [ ] Remove all LLM keys, LLM SDKs and direct LLM calls from web and mobile code, `.env` files and CI secrets.
- [ ] AI Search calls `POST /v1/ai/search` on submit (not on every keystroke).
- [ ] Search results show `filters` as chips and render `ai_badges` only when non-empty.
- [ ] "Load more" re-sends the same `query` with the next `page`.
- [ ] Listing wizard calls `POST /v1/ai/generate-listing` with the JWT and pre-fills (does not auto-save) the title, EN/BN descriptions and amenities.
- [ ] Sizes are converted to **sqft** before sending `area_size`.
- [ ] Bengali font available on web and mobile.
- [ ] `503` / `1600` shows a friendly "AI is busy" message with a Retry button (at most one automatic retry after `Retry-After`).
- [ ] Client request timeout ≥ 30 seconds, with loading states on both features.
- [ ] `401` triggers the normal token-refresh flow.

---

## 7. Local Development Notes

- With the **dummy keys** currently seeded on the dev database, both endpoints return **`503` (1600)**. Use this to build and test the error UI. Real results appear once the team seeds real Groq keys; no frontend change is needed.
- AI Search only returns **active and verified** listings. If search is empty on a fresh database, verify some seeded properties first.

---

## 8. Common Error Codes Reference (AI)

| Code | Message                                                                    | HTTP Status |
|------|----------------------------------------------------------------------------|-------------|
| 1600 | AI service is experiencing high demand. Please try again in a few moments. | 503         |
| 1601 | The AI service returned an unexpected response. Please try again.          | 502         |
| 1602 | The AI service could not process this request.                             | 502         |
| 1603 | Please describe what you are looking for in a few more words.              | 400         |
| 1400 | Area not found                                                             | 404         |
| 1100 | Unauthorized (missing/expired JWT)                                         | 401         |
| 1001 | Request validation failed                                                  | 400         |
| 1000 | ThrottlerException: Too Many Requests (HTTP 429)                           | 429         |
