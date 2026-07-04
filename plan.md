# Homenet — Full Website Implementation Plan

> **Bangladesh-based Land & Property Marketplace**
> Tech Stack: **HTML + Vanilla CSS + Vanilla JavaScript**
> Design Inspiration: **Hemnet (Sweden)** — adapted for Bangladesh

---

## 1. Project Overview

Homenet is a premium, minimal, trust-focused property marketplace for Bangladesh that integrates:
- Property listings (land plots, apartments, commercial)
- Legal verification with trust badges
- Mortgage comparison (EMI, interest rates)
- Insurance options
- Guided UX for non-tech users

**Core UX Flow:**
`Discover Property → Verify → Compare Mortgage → Add Insurance → Contact Owner`

---

## 2. File Structure

```
Hemnet/
├── index.html                  ✅ DONE (Homepage)
├── listings.html               🔲 TODO
├── property.html               🔲 TODO (MOST IMPORTANT)
├── mortgage.html               🔲 TODO
├── insurance.html              🔲 TODO
├── dashboard.html              🔲 TODO
├── css/
│   └── styles.css              ✅ DONE (Design system + homepage)
├── js/
│   └── main.js                 ✅ DONE (Homepage interactions)
├── images/                     ✅ 12 images ready
└── plan.md                     ← This file
```

---

## 3. Design System (in css/styles.css)

### Colors
| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#0a8a2a` | CTAs, active states, brand |
| `--color-primary-dark` | `#077a22` | Hover states |
| `--color-primary-light` | `#e8f5e9` | Verification badge bg |
| `--color-white` | `#ffffff` | Page background |
| `--color-text` | `#1a1a1a` | Primary text |
| `--color-text-secondary` | `#525252` | Secondary text |
| `--color-text-muted` | `#737373` | Captions |
| `--color-border` | `#e0e0e0` | Borders |

### Typography
- Font: `Inter` (Google Fonts)
- Scale: 11, 12, 14, 16, 18, 20, 24, 32px
- Weights: 400, 500, 600, 700

### Spacing
- 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48px

### Breakpoints
- Mobile: < 600px (default)
- Tablet: 600-959px
- Desktop: 960px+ (max-width 960px container)

---

## 4. Page Specifications

### 4.1 Homepage (index.html) — ✅ DONE
1. Header — Sticky green bar, logo, nav tabs
2. Search — Area input, filters, green CTA
3. Housing News — Hero card + 8 article cards (2-col)
4. Top Lists — 3 horizontal scroll sections
5. Footer — Contact, Apps, Social, Legal

### 4.2 Listings Page (listings.html) — TODO

Sections:
- Compact search bar at top
- Filter pills row (Location, Price, Size, Type, More) — horizontal scroll
- Map/List view toggle buttons
- Results count text
- Vertical stack of listing cards
- Load More button

Each listing card:
- Full-width image (200px height)
- Price large bold (20px)
- Location with pin icon
- Size + Type meta
- Green verification badge

CSS classes needed:
- `.listings__filters` — flex, gap 8px, overflow-x auto
- `.filter-pill` — pill button, 1.5px border, 9999px radius
- `.filter-pill--active` — green bg, white text
- `.listing-card` — 12px radius, shadow-md, margin 0 16px 16px
- `.listing-card__img` — 100% width, 200px height, object-fit cover
- `.listing-card__price` — 20px, weight 700
- `.listing-card__verified` — green badge pill

JS needed: filter toggles, map/list toggle, sort, load-more

### 4.3 Property Details (property.html) — TODO — MOST IMPORTANT

Sections (top to bottom):
1. Image gallery — horizontal swipe, scroll-snap, dot indicators, counter
2. Price + Location + Verified badge
3. Key details 2-col grid (Area, Type, Facing, Road, Zoning, Registration)
4. Description paragraph
5. Verification checklist (green checks, amber pending)
6. Price history line chart (Chart.js)
7. Mortgage comparison preview (2-3 bank cards with EMI)
8. Insurance options preview (Basic vs Premium cards)
9. Contact section (Call, Schedule Visit, Message buttons)
10. Sticky bottom CTA bar on mobile

Chart.js CDN: `https://cdn.jsdelivr.net/npm/chart.js`

CSS classes needed:
- `.gallery` — flex, overflow-x auto, scroll-snap-type x mandatory
- `.gallery__slide` — flex 0 0 100%, scroll-snap-align start
- `.gallery__dots` — flex, justify-content center, gap 6px
- `.detail__price` — 24px, weight 700
- `.detail__location` — 16px, color secondary, map pin icon
- `.detail__grid` — 2-col grid, gap 16px
- `.verification-list` — checklist with green/amber icons
- `.mortgage-preview` — horizontal scroll cards
- `.contact-bar` — fixed bottom, white bg, shadow, padding 12px 16px

JS needed: gallery swipe + counter, lightbox, Chart.js init, sticky bar

### 4.4 Mortgage Page (mortgage.html) — TODO

Sections:
1. Calculator inputs (price, down payment slider, loan term selector)
2. EMI result card (green bg, large amount)
3. Lender comparison cards (Bank Asia, BRAC Bank, City Bank, etc.)
4. Cost breakdown pie chart (Chart.js doughnut)

EMI Formula: `EMI = P * r * (1+r)^n / ((1+r)^n - 1)`

CSS classes needed:
- `.calculator` — padding 24px, bg f5f5f5, radius 12px
- `.calculator__input` — full width, 12px padding, 1.5px border
- `.calculator__slider` — accent-color primary green
- `.emi-result` — green bg, white text, 32px amount
- `.lender-card` — white bg, 1.5px border, 12px radius

JS needed: real-time EMI calc, chart update, sort lenders

### 4.5 Insurance Page (insurance.html) — TODO

Sections:
1. Hero text "Protect Your Property"
2. Plan cards (Basic ৳2,500/yr, Premium ৳5,000/yr)
3. Premium card highlighted with green border + "Recommended" badge
4. Feature checklists per plan
5. "Why Insure?" — 3 icon cards
6. FAQ accordion

CSS classes needed:
- `.plan-card` — white, 1.5px border, 12px radius, 24px padding
- `.plan-card--premium` — border-color primary, recommended badge
- `.plan-card__price` — 28px, weight 700
- `.plan-card__cta` — full width green pill button
- `.faq__item` — border-bottom divider
- `.faq__question` — 16px, weight 600, flex between

JS needed: FAQ accordion toggle

### 4.6 Dashboard Page (dashboard.html) — TODO

Sections:
1. Welcome message
2. Quick actions 2x2 grid (Search, Saved, Compare, Settings)
3. Saved listings horizontal scroll
4. Verification progress cards with progress bars
5. Financial actions list (chevron links)

CSS classes needed:
- `.dashboard__welcome` — 20px, weight 700
- `.quick-actions` — 2-col grid, 12px gap
- `.quick-action` — bg f5f5f5, 12px radius, center text
- `.progress-bar` — 8px height, e0e0e0 bg, green fill
- `.financial-item` — flex between, bottom border

---

## 5. Shared Components

### Header (identical all pages)
- Sticky green bar, logo "Homenet", user + menu icons
- 3 nav tabs: For Sale, Find Prices, Search for a Broker
- Active tab changes per page

### Footer (identical all pages)
- Contact links, App links (iPhone, Android), Social links, Legal

### Property Card (reusable)
- Image, badge number, location, size overlay
- Used on: Homepage, Listings, Dashboard

### Verification Badge
- `✓ Verified` — green pill: bg #e8f5e9, color #0a8a2a
- `⏳ Pending` — amber pill: bg #fff8e1, color #f57f17

---

## 6. Trust & Conversion Optimization

### Trust Signals
- Verification badges on every verified card
- Legal verification checklist (Title, Survey, Mutation, Encumbrance)
- "Verified by Homenet's Legal Partners" tagline
- Government registration number display
- Seller rating & history

### Conversion Optimization
- Sticky CTA bar on property detail (mobile)
- Social proof: "24 people viewed today"
- Urgency: "Listed 2 days ago"
- One-tap: Call, WhatsApp, Schedule Visit
- Progressive disclosure: key details first, expand for more

### Non-Tech User Adaptations
- Large touch targets (min 44px)
- Simple language, no jargon
- Icons + text labels together
- Step-by-step guided flow

---

## 7. External Dependencies

| Library | Purpose | CDN |
|---|---|---|
| Inter Font | Typography | Google Fonts |
| Chart.js 4.x | Charts | cdn.jsdelivr.net/npm/chart.js |
| Leaflet.js 1.9.x | Maps | unpkg.com/leaflet |

---

## 8. Bangladesh-Specific Units
- Land: katha, bigha, decimal
- Apartments: sqft
- Currency: ৳ (Taka), Lakh, Crore

---

## 9. Build Order
1. ✅ Homepage
2. 🔲 Property Details (most important)
3. 🔲 Listings
4. 🔲 Mortgage
5. 🔲 Insurance
6. 🔲 Dashboard

---

## 10. Rules for AI Builder
1. Reuse CSS variables from styles.css — NO new colors/spacing
2. Mobile-first CSS, then @media 600px and 960px
3. BEM naming: block__element--modifier
4. Append all CSS to same styles.css file
5. Header + Footer identical across pages (copy from index.html)
6. Images in images/ folder — reuse or generate new
7. Chart.js/Leaflet only on pages that need them
8. Semantic HTML: section, article, nav, main
9. All interactive elements need aria-labels
10. All images need alt text
