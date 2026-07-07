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

**Standard Build (Production):**
```bash
npm run build
npm run start:prod
```

Once running, the API Swagger documentation will be accessible at:
[http://localhost:3000/api/docs](http://localhost:3000/api/docs)

## 5. Running Tests
The project uses Jest for testing.

**Run Unit Tests:**
```bash
npm run test
```

**Run Tests in Watch Mode (for active development):**
```bash
npm run test:watch
```
