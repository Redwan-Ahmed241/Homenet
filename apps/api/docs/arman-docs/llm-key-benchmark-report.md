# LLM API Key Retrieval & Decryption: Benchmark Report

**Date:** 2026-10-01
**Scope:** Cost of getting a usable LLM API key for each smart-search / smart-listing request
**Environment:** Local machine → Neon PostgreSQL (`ap-southeast-1`), 3 encrypted Groq keys in `llm_api_keys`, NestJS app built from `dist/`

---

## 1. Summary

- **No request fetches or decrypts a key.** All keys are decrypted once at startup and kept in memory.
- **Per LLM call, the key step costs one database round trip:** ~52 ms median from a local machine. That is almost entirely network; CPU work is under 1 ms.
- **Decryption is negligible:** 38 µs per key. 1000 decryptions take 40 ms in total.
- **Fetching and decrypting on every request would add a second round trip** (~52 ms) to every LLM call. Keeping decrypted keys in memory avoids that.
- **Under 20 concurrent requests**, the key step handles about 230 calls per second. Tail latency (p99 ~500 ms) comes from the database connection pool, not from encryption.

---

## 2. How key handling works

### At startup (once per server instance)

`LlmKeyVaultService.onModuleInit`:

1. Reads every row from `llm_api_keys` (encrypted key, IV, auth tag).
2. Decrypts each key with AES-256-GCM, using `LLM_MASTER_ENCRYPTION_KEY` and the key alias as authenticated data.
3. Creates a Groq client per key and keeps the ring in memory.

The decrypted keys never leave the process.

### On every LLM call

`LlmRotatorService.acquire()`:

1. **One DB query** (`readSharedState`). It reads:
   - the next rotation position (`nextval('llm_rotation_seq')`)
   - accounts in cooldown
   - revoked keys
   - a fingerprint of the key set

   **It does not read the encrypted key.**
2. **Fingerprint check** (`ensureFresh`), an in-memory string compare. Keys are fetched and decrypted again only if the key set changed, e.g. after `npm run seed:llm-keys`.
3. **Pick a key** from the in-memory ring and use its ready Groq client.

```
Startup:   DB (all key rows) → decrypt each → in-memory ring of Groq clients
Request:   DB (rotation state only) → fingerprint compare → pick client → Groq
```

---

## 3. Method

The script booted the real application services with `NestFactory.createApplicationContext(AppModule)` and called them directly:

- **No HTTP layer.** Request handling was measured separately in `llm-request-latency.md`.
- **No Groq calls**, so no LLM quota was used.
- **Run settings:**
  - Each test had 5 warm-up runs first.
  - The measured runs used `performance.now()` per operation, `process.cpuUsage()` for CPU time, and heap usage with explicit GC (`--expose-gc`).
  - Decrypted keys were never printed.

| Test | What runs | Iterations |
|---|---|---|
| A | Real per-request key step: `LlmRotatorService.acquire()` | 1000, sequential |
| A2 | Same as A with 20 requests in flight | 1000, concurrency 20 |
| B | Hypothetical: fetch one key row by alias + decrypt it, every request | 1000, sequential |
| C | Decrypt only (`LlmCryptoService.decrypt`) on a row fetched once | 1000, sequential |
| D | Full vault load: fetch all key rows + decrypt all + build Groq clients | 20, sequential |

---

## 4. Results

| Test | Total | Mean | Median | p90 | p99 | Min | Max | CPU per op |
|---|---|---|---|---|---|---|---|---|
| **A. Real key step** | 53.1 s | 53.1 ms | **52.4 ms** | 53.3 ms | 77.5 ms | 51.1 ms | 134.8 ms | 0.84 ms |
| A2. Real key step, 20 concurrent | 4.4 s | 86.5 ms | 79.4 ms | 92.7 ms | 502.0 ms | 54.1 ms | 510.9 ms | 1.2 ms |
| B. Fetch + decrypt per request | 52.1 s | 52.1 ms | 51.6 ms | 52.6 ms | 77.8 ms | 49.4 ms | 147.1 ms | 1.6 ms |
| **C. Decrypt only** | **40 ms** | 39.8 µs | **38.1 µs** | 39.8 µs | 73.1 µs | 36.5 µs | 228.0 µs | 32 µs |
| D. Full vault load (20 runs) | 1.05 s | 52.7 ms | 52.9 ms | 53.6 ms | 53.8 ms | 51.2 ms | 53.8 ms | 10.2 ms |

Heap growth over each run was 0.7–3.7 MB. That is short-lived garbage from Prisma query objects, not retained memory.

---

## 5. Findings

1. **Network dominates the key step.** A bare `SELECT 1` to Neon takes the same ~50–120 ms from this machine. CPU per call is 0.84 ms, mostly Prisma building and parsing the query.
2. **Encryption is not a performance factor.**
   - One decryption takes 38 µs, about 0.07% of a single Neon round trip.
   - Decrypting the whole 3-key pool takes about 0.1 ms.
   - Even 50 keys would take about 2 ms, once at startup.
3. **Test B shows what in-memory caching saves.** B costs about the same as A because both are one round trip. Without caching, each LLM call would need *both* the rotation read and the key fetch: about 104 ms instead of 52 ms. A search request (up to 2 LLM calls) would lose about 104 ms.
4. **Concurrency is limited by the DB connection pool.**
   - With 20 requests in flight, throughput is about 230 acquisitions per second and the median rises to 79 ms.
   - p99 reaches about 500 ms because requests wait for a free Prisma connection.
   - Raising the pool size (`connection_limit` in `DATABASE_URL`) would help under heavy load. Encryption plays no part.
5. **A full vault reload is cheap** (~53 ms, one query). Re-seeding keys has no meaningful cost for running servers.

---

## 6. Conclusion

The encryption design adds no measurable latency to requests, because decryption happens once at startup and costs microseconds. The per-request cost of the key system is the single shared-state database read. That read is what keeps rotation, cooldowns and revocations consistent across all Vercel instances. Its cost is set by network distance to Neon:

- ~52 ms from a local machine
- expected to be a few ms on Vercel in the same region (not measured)

**No changes are recommended.** If request latency needs to come down, the next step is to deploy Vercel functions in the same region as Neon.

---

## 7. Side effects of the benchmark

- `llm_rotation_seq` advanced by about 1020: tests A and A2 plus warm-ups. That matches 1020 real calls; rotation simply continues from the new position.
- Everything else was read-only.
- No Groq calls were made, and no key usage counters changed.

---

## Appendix: Reproducing

1. Build: `npx nest build`
2. Run the script below with `node --expose-gc bench-keys.mjs 1000`. Set `root` to your local `apps/api` path.

```js
// Benchmarks the LLM key path against the real app code and Neon. No Groq calls; never prints keys.
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const root = 'D:/Fazesoft/Homenet/Homenet_backend/apps/api/';
const require = createRequire(root + 'package.json');
const load = (p) => import(pathToFileURL(root + 'dist/src/' + p).href);
const { NestFactory } = await import(pathToFileURL(require.resolve('@nestjs/core')).href);

const { AppModule } = await load('app.module.js');
const { LlmRotatorService } = await load('infrastructure/llm/services/llm-rotator.service.js');
const { LlmCryptoService } = await load('infrastructure/llm/services/llm-crypto.service.js');
const { LlmKeyVaultService } = await load('infrastructure/llm/services/llm-key-vault.service.js');
const { PrismaService } = await load('config/prisma/prisma.service.js');

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const rotator = app.get(LlmRotatorService, { strict: false });
const crypto = app.get(LlmCryptoService, { strict: false });
const vault = app.get(LlmKeyVaultService, { strict: false });
const prisma = app.get(PrismaService, { strict: false });

const N = Number(process.argv[2] ?? 1000);
const pct = (s, p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
const fmt = (ms) => (ms < 1 ? `${(ms * 1000).toFixed(1)} µs` : `${ms.toFixed(1)} ms`);
const results = [];

async function bench(name, n, fn, concurrency = 1) {
  for (let i = 0; i < Math.min(5, n); i++) await fn(); // warm-up
  global.gc?.();
  const heap0 = process.memoryUsage().heapUsed;
  const cpu0 = process.cpuUsage();
  const times = [];
  const wall0 = performance.now();
  let next = 0;
  const worker = async () => {
    while (next < n) {
      next++;
      const t = performance.now();
      await fn();
      times.push(performance.now() - t);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  const wall = performance.now() - wall0;
  const cpu = process.cpuUsage(cpu0);
  const heap = process.memoryUsage().heapUsed - heap0;
  times.sort((a, b) => a - b);
  results.push({
    test: name, n, concurrency,
    total: fmt(wall),
    mean: fmt(times.reduce((a, b) => a + b, 0) / n),
    median: fmt(pct(times, 0.5)), p90: fmt(pct(times, 0.9)), p99: fmt(pct(times, 0.99)),
    min: fmt(times[0]), max: fmt(times[n - 1]),
    cpuPerOp: fmt((cpu.user + cpu.system) / 1000 / n),
    heapDelta: `${(heap / 1024).toFixed(0)} KB`,
  });
}

const row = await prisma.llmApiKey.findFirst({
  where: { status: { not: 'REVOKED' } },
  select: { key_alias: true, encrypted_key: true, iv: true, auth_tag: true },
});

const acquire = async () => {
  if (!(await rotator.acquire(new Set()))) throw new Error('no key acquired');
};
await bench('A. real key path: acquire()', N, acquire);
await bench('A2. same, 20 concurrent', N, acquire, 20);
await bench('B. fetch key row + decrypt every request', N, async () => {
  const r = await prisma.llmApiKey.findUnique({
    where: { key_alias: row.key_alias },
    select: { key_alias: true, encrypted_key: true, iv: true, auth_tag: true },
  });
  crypto.decrypt(r, r.key_alias);
});
await bench('C. decrypt only', N, async () => crypto.decrypt(row, row.key_alias));
await bench('D. full vault load', 20, () => vault.load());

console.table(results);
await app.close();
process.exit(0);
```
