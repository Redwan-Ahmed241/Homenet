# SaaS Monorepo Architecture Plan (Homenet)

## Technology Stack
- **Monorepo Tooling:** Nx
- **Web Application:** Next.js
- **Mobile Application:** React Native (Expo)
- **Backend API:** NestJS
- **Database:** Prisma ORM with SQLite (acting as in-memory/local for development)
- **UI Architecture:** Universal UI using Tamagui (sharing components between Web and Mobile)

## Proposed Directory Structure
```text
homenet/
├── apps/
│   ├── api/                   # NestJS Backend
│   ├── web/                   # Next.js Web App
│   └── mobile/                # React Native (Expo) App
│
├── libs/
│   ├── shared/                
│   │   ├── types/             # Universal TS interfaces
│   │   └── utils/             # Shared helper functions
│   ├── data-access/           # API clients and React Query hooks
│   ├── ui-universal/          # Tamagui shared components
│   └── backend/               # NestJS specific modules and Prisma schema
```

## Implementation Phases

### Phase 1: Workspace Initialization
1. Initialize a new Nx workspace.
2. Install plugins for Next.js, React Native/Expo, and NestJS.

### Phase 2: Application Generation
1. Generate `apps/web` (Next.js).
2. Generate `apps/mobile` (Expo).
3. Generate `apps/api` (NestJS).

### Phase 3: Shared Libraries & UI
1. Create `libs/shared/types`, `libs/shared/utils`, and `libs/data-access`.
2. Create `libs/ui-universal` and configure Tamagui for cross-platform support.

### Phase 4: Database & Backend
1. Initialize Prisma with SQLite in `libs/backend`.
2. Create Prisma service in `apps/api`.
3. Implement in-memory development workflow.

## Verification
- Run `nx serve web`
- Run `nx start mobile`
- Run `nx serve api`
- Validate shared component rendering and API connectivity.