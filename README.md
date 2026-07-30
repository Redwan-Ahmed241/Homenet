# Homenet — AI-Powered Real Estate Intelligence Platform

## Overview
**Homenet** is aspiring to be South Asia's leading property intelligence platform and marketplace, built specifically to transform Bangladesh's real estate market from an opaque, trust-deficit environment into a transparent, data-driven ecosystem.

**Core Design Philosophy:**
> "Simple enough to scale; safe enough to trust."

Homenet acts as a technology-first layer for the real estate market. We deliberately avoid operational bloat—no large field staff fleets, no in-house legal underwriting, and no complex transaction management. Instead, we solve the market's two biggest problems (fraud and pricing opacity) through smart, lean technology.

---

## 🏢 Business Strategy & Value Proposition

### 1. Two-Layer Trust System
We build trust in our marketplace without becoming a full-service agency:
- **Layer 1: Homenet Verified Badge** — A ৳1,500–3,000 upgrade that confirms property existence and basic ownership via NID matching, title deed/tax receipt validation, and GPS site photo tags. (Note: confirms existence, does not constitute a legal guarantee).
- **Layer 2: Approved Partner Program** — Vetted, regulated dalals/agents who sign a code of conduct. They operate on a fixed fee model (max ৳5,000–10,000 or 0.5%), replacing the traditional, unstandardized 1-2% commission.

### 2. Defensible Moats & Intelligence
- **Proprietary Data Moat:** Actively collecting structured, verified real estate data—building an asset that competitors cannot easily replicate.
- **AI Valuation Engine:** Analyzing historical and active data to provide fair-market price estimates, empowering buyers and flagging overpriced properties.
- **Premium User Experience:** Inspired by Hemnet (Sweden), offering a mobile-first, clutter-free UX built for conversion and trust.

### 3. Lean Monetization (The Revenue Flywheel)
1. **Phase 1 (Launch):** Free listings to build supply. Revenue from optional listing boosts (Featured, Ranked) and Verified Badges.
2. **Phase 2 (Scale):** Make Verified Badges a requirement for top search ranking. Introduce Approved Partner subscriptions.
3. **Phase 3 (Expand):** Banner advertising, developer campaigns, and lead generation for external financial partners (mortgages/insurance).

---

## 💻 Technical Architecture

The platform uses a **monolithic backend with micro-service readiness**, heavily leveraging modern TypeScript tooling within a monorepo setup.

### Core Tech Stack
- **Backend (API):** Nest.js, TypeScript, PostgreSQL (via Prisma ORM)
- **Frontend (Web):** Next.js (SEO-optimized web app)
- **Frontend (Mobile):** React Native (iOS & Android)
- **Infrastructure:** Docker, Cloudinary (Assets), AWS (planned)
- **AI/ML Layer:** XGBoost for property valuation modeling, NLP models for natural language search and automated agreement parsing.

### Key Technical Capabilities
- **Advanced RBAC:** Structured Role-Based Access Control distinguishing Buyers, Sellers, Partners, Moderators, and Admins.
- **Spatial Area Management:** PostGIS integration for fast geographic boundary queries, local pricing metrics, and map-based exploration.
- **Real-Time Communication:** WebSockets-based secure messaging between buyers and sellers, supported by automated AI chatbot tenant assistants.
- **Scalable Monorepo:** Structured using NPM workspaces (`apps/api`, `apps/web`, `apps/mobile`, `packages/shared`, `packages/ui`).

---

## 🚀 5-Year Roadmap Summary

- **Phase 1 (Months 1–6):** MVP Launch in Dhaka. Core listing flow, AI valuation model, and Verified Badge system implementation. 
- **Phase 2 (Months 7–18):** Scale to Chittagong and Sylhet. Activate Approved Partner Program, natural language AI search, and full boost monetization.
- **Phase 3 (Year 2+):** Integrate third-party financial services (mortgages/insurance referrals), advanced document parsing, and enterprise APIs. Keep the core platform simple.
- **Years 4-5:** Full national coverage across all 64 districts, scaling into a regional South Asian PropTech platform.
