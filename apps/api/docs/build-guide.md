# Build & Run Guide

This guide covers how to get the Homenet API up and running locally, as well as how to execute the test suite.

## 1. Prerequisites
- **Node.js** (v18+ recommended)
- **Database**: You must have PostgreSQL running and configured. 
  👉 **If you haven't set up the database yet, please follow the [Database Development Guide](./db-dev-guide.md) first.**

## 2. Install Dependencies
Run the following command in the `apps/api` directory to install all necessary packages:
```bash
npm install
```

## 3. Environment Variables
Ensure you have a `.env` file in the root of the project with the required variables (e.g., `DATABASE_URL`, `JWT_SECRET`, etc.).

## 4. Build & Run
You can run the application in several modes:

**Development Mode (Live Reload):**
```bash
npm run start:dev
```
> This will automatically run any pending Prisma migrations before starting the NestJS server in watch mode.

**Full Dev Setup (Reset + Seed + Run):**
```bash
npm run dev:setup
```
> This is a one‑command workflow that resets the database, re‑applies all migrations, seeds the database with sample data, and starts the dev server. Useful when you want a clean slate.

**Standard Build (Production):**
```bash
npm run build
npm run start:prod
```

Once running, the API Swagger documentation will be accessible at:
[http://localhost:3000/api/docs](http://localhost:3000/api/docs)

## 5. Database Seeding
The project ships with seed scripts that populate the database with sample areas and property listings for local development.

**Automatic Seeding:**
Seeding runs automatically when you use `npm run dev:setup` (i.e. on `prisma migrate reset`). The seed command is configured in `prisma.config.ts` and executes `prisma/seeds/seed.ts`, which orchestrates the individual seed files in the correct order.

**Manual Seeding:**
You can also trigger seeding on demand without resetting the database:
```bash
npx prisma db seed
```

**Individual Seed Scripts:**
If you only need to seed a specific domain, you can run each script independently:
```bash
npm run seed:areas        # Seeds area/location data
npm run seed:properties   # Seeds sample property listings
```

> **Note:** All seed scripts use Prisma `upsert` operations, so they are safe to run repeatedly without creating duplicate records.

## 6. Running Tests
The project uses Jest for testing.

**Run Unit Tests:**
```bash
npm run test
```

**Run Tests in Watch Mode (for active development):**
```bash
npm run test:watch
```
