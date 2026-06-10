# Testing Conventions

## Backend (NestJS) Tests

### Stack
- **Jest 29** (test runner)
- **Supertest** (HTTP assertions)
- **@testcontainers/postgresql** (real PostgreSQL in a container)
- TypeScript via `ts-jest`

### Philosophy (NON-NEGOTIABLE)

- **Integration tests through HTTP endpoints only**. No direct DB access (`dataSource.getRepository()`) in assertions.
- **Real PostgreSQL** via Testcontainers. Never SQLite or in-memory substitutes.
- **Mock only external services**: email, third-party APIs, RabbitMQ broker, cache. NEVER mock repositories or the database.
- **Verify via API**: create with POST, verify with GET, confirm conflicts with duplicate POST.
- Each e2e test composes its NestJS module manually via `createTestApp()`. MUST NOT import the real `ApplicationModule` (loads real config and pollutes the test).

### Layout

```
test/
├── setup/jest-setup.ts                # Polyfills (crypto, File for undici)
├── helpers/
│   ├── test-app.helper.ts             # createTestApp() — spins NestJS + Testcontainer
│   └── db.helper.ts                   # cleanDatabase() — TRUNCATE all tables between tests
├── factories/
│   └── <entity>.factory.ts            # buildXxxDto() — unique data per call
└── modules/
    └── <feature>/
        └── <action>.e2e-spec.ts
```

### Key test patterns

- **Helper functions in tests MUST NOT be `async`** — they return the supertest `Test` chain directly so `.expect()` composes.
- `beforeAll` timeout: `60_000` ms (Testcontainer startup).
- `afterEach`: `cleanDatabase(dataSource)` + `jest.clearAllMocks()`.
- `afterAll`: `app.close()` + `pgContainer.stop()`.
- Import supertest as default: `import request from 'supertest'` (NOT `import * as`).
- Inside `test/` files use **relative imports**, not path aliases.

### Running

```bash
cd <ms-xxx>
npm run test                                   # unit
npm run test:e2e                               # integration (needs Docker)
npm run test:e2e -- --testPathPattern=foo      # filter by file pattern
npm run test:cov                               # coverage
```

### Mocking the cache and broker

Provide no-op mocks for `ICacheService` (`get` returns `null`, `set/del` are no-ops) and `IMessageBroker` (`publish/publishToTopic` no-ops). Tests then exercise real DB + real handlers without depending on Redis or RabbitMQ.

### Naming

`describe('Create Foo (e2e)', () => { it('should create and retrieve a foo', ...) })`.

Test file: `<action>-<feature>.e2e-spec.ts` (e.g., `register-user.e2e-spec.ts`).

## Frontend (Vue) Tests

### Stack
- **Vitest 3** (test runner)
- **@vue/test-utils 2.4**
- **Cypress 14** for end-to-end

### Layout

```
vsad-tajo-frontend/
├── src/
│   └── **/<component>.spec.ts         # Component tests next to source
├── cypress/
│   └── e2e/<scenario>.cy.ts           # Cypress e2e
```

### Running

```bash
cd vsad-tajo-frontend
npm run test                  # vitest
npm run check                 # type check
npx cypress open              # interactive
npx cypress run               # headless e2e
```

## Test the Right Thing

- Test **behavior**, not implementation.
- One assertion concept per test.
- Mock at the port boundary (repositories implement abstract classes in `domain/ports/`).
- Use factories for setup; never hardcode UUIDs unless asserting on them.
- A failing test must point to a specific endpoint or invariant.
