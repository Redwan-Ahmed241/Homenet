# Homenet — Bangladesh Property Marketplace

Homenet is a premium, trust-focused online marketplace for buying and selling land, apartments, and commercial properties in Bangladesh. The platform is inspired by Hemnet (Sweden) and adapted for the Bangladesh real estate market.

## Purpose

Homenet solves the key pain points in Bangladesh's property market:

- **Trust & Verification** — Every property undergoes legal verification (title deed, survey sketch, mutation, encumbrance) with visible trust badges
- **Financial Clarity** — Built-in mortgage calculator compares EMI rates from multiple banks
- **Insurance Options** — Property insurance plans to protect your investment
- **Guided User Experience** — Simple, jargon-free interface designed for non-tech users with large touch targets and clear language

## Core User Flow

```
Discover Property → Verify → Compare Mortgage → Add Insurance → Contact Owner
```

## Features

| Feature | Description |
|---------|-------------|
| **Property Listings** | Browse verified land plots, apartments, commercial properties across Bangladesh |
| **Legal Verification** | Green checkmarks for verified properties, pending items clearly shown |
| **Mortgage Calculator** | Real-time EMI calculation with lender comparison from top banks |
| **Property Insurance** | Basic and Premium plans with feature comparison |
| **User Dashboard** | Save properties, track verification progress, access financial tools |
| **Mobile-First Design** | Responsive layout for all screen sizes |

## Tech Stack

- **HTML5** — Semantic markup
- **Vanilla CSS** — Custom design system with CSS variables
- **Vanilla JavaScript** — Interactivity, Chart.js for data visualization, Leaflet for maps
- **External Libraries**: Chart.js (charts), Leaflet (maps)

## Bangladesh-Specific Features

- Land units: katha, bigha, decimal
- Apartment units: sqft
- Currency: ৳ (Taka), displayed in Lakh/Crore format

## File Structure

```
Hemnet/
├── index.html          # Homepage with search, housing news, top listings
├── listings.html       # Property search results with filters
├── property.html      # Property detail page with gallery, verification, mortgage preview
├── mortgage.html      # Mortgage calculator and bank comparison
├── insurance.html     # Insurance plans and FAQ
├── dashboard.html    # User dashboard with saved properties
├── css/
│   └── styles.css    # Design system and all component styles
├── js/
│   └── main.js       # Common interactions
└── images/           # Property and news images
```

## Design System

- **Primary Color**: `#0a8a2a` (green)
- **Font**: Inter (Google Fonts)
- **Max Container Width**: 960px
- **Breakpoints**: Mobile (<600px), Tablet (600-959px), Desktop (960px+)

## Getting Started

Open any `.html` file directly in a browser. No build step or server required.

## External Dependencies

| Library | Purpose | CDN |
|---------|---------|-----|
| Inter Font | Typography | Google Fonts |
| Chart.js 4.x | Charts | cdn.jsdelivr.net/npm/chart.js |
| Leaflet.js 1.9.x | Maps | unpkg.com/leaflet |

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

© 2025 Homenet Bangladesh