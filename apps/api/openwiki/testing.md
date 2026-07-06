# Testing

The project uses **Jest** for both unit and end‑to‑end (e2e) tests.  All test files live under the `test/` directory and follow the standard Nest testing patterns.

## Test Structure
- **Unit tests** – target individual services, guards, etc. located in `test/modules/<module>/` (e.g., `test/modules/auth/auth.service.spec.ts`). They use `@nestjs/testing` to create a testing module, mock dependencies (Prisma, JWT, Config, Logger), and verify business logic.
- **E2E tests** – spin up the full Nest application using `Test.createTestingModule({ imports: [AppModule] })` and exercise HTTP endpoints via `supertest`. The entry point is `test/app.e2e-spec.ts`.
- **Jest config** – defined in `test/jest-e2e.json` (for e2e) and the default `jest` section in `package.json` (for unit tests). The config sets `moduleFileExtensions`, `testRegex`, and uses `ts-jest` for TypeScript.

## Running Tests
```bash
# Unit tests only
npm run test

# Watch mode (re‑run on file changes)
npm run test:watch

# End‑to‑end tests
npm run test:e2e
```

## Adding New Tests
1. **Create a spec file** – name it `*.spec.ts` under the appropriate subdirectory (`test/modules/<module>/`).
2. **Import the class under test** and any required mocks.
3. **Use `describe` / `it`** blocks to structure test cases.
4. **Mock external services** (e.g., Prisma, JwtService) using Jest’s `jest.mock` or manual mock objects as shown in `auth.service.spec.ts`.
5. **Run the suite** to ensure coverage passes.

## Test Coverage
- Coverage reports are generated with `npm run test:cov` and stored in the `coverage/` folder.
- Aim for high coverage on critical business logic (Auth, RBAC, error handling).

---
**Key files**: `test/`, `package.json` (scripts), `jest-e2e.json`, example spec files in `test/modules/`
