# LLM API Key Security: Is Decrypting All Keys at Startup Safe?

**Date:** 2026-10-01
**Scope:** Security of decrypting all stored Groq API keys into server memory at startup (`LlmKeyVaultService`)
**Related:** `llm-key-benchmark-report.md` (performance), `llm-request-latency.md` (request flow)

---

## 1. Summary

**Yes, it is safe, and it is standard practice.** Any server that calls an external API must hold the plaintext key in memory while it makes the call. A key in a `.env` file works exactly the same way.

The encryption protects the keys **at rest**, in the database. It cannot protect them from someone who controls the running server, and no decryption timing can do that either. Decrypting once at startup is as secure as decrypting per request, and much faster.

---

## 2. How keys are handled

| Stage | Where the key is | Form |
|---|---|---|
| Stored | Neon table `llm_api_keys` | AES-256-GCM ciphertext + IV + auth tag; the alias is bound as authenticated data |
| Master key | Environment variable `LLM_MASTER_ENCRYPTION_KEY` (Vercel env / local `.env`) | 64 hex characters, never stored in the DB |
| Server startup | `LlmKeyVaultService.onModuleInit` | Rows fetched, decrypted, wrapped in Groq clients, kept in process memory |
| Each LLM call | In-memory ring | Ready Groq client used directly; nothing decrypted |
| Client / browser | — | Never receives a key |

---

## 3. Threat model

### 3.1 What the encryption protects against: database exposure without server access

| Scenario | Result |
|---|---|
| Neon backup or export leaks | Attacker gets ciphertext only |
| SQL injection bug | Attacker gets ciphertext only |
| Someone with Neon dashboard or read-only DB access | Sees ciphertext only |
| `DATABASE_URL` leaks | Attacker gets ciphertext only |
| Ciphertext copied from one row to another | Decryption fails: the alias is authenticated data, so swapped rows are rejected |

In all of these, the attacker needs the master key as well. The master key is stored separately, in environment variables.

### 3.2 What it cannot protect against: a compromised server

If an attacker can run code on the server, or read its memory, environment or disk, they can obtain the keys.

**Decrypting per request instead of at startup would not change this:**

- The master key and the database credentials sit on the same server, so an attacker there can decrypt every key themselves.
- JavaScript strings cannot be wiped from memory after use. Per-request decryption would only leave more short-lived plaintext copies waiting for garbage collection.

Startup decryption and per-request decryption are therefore **equally secure**. Startup decryption is much faster: ~38 µs once per key, versus an extra ~52 ms database round trip on every call.

---

## 4. Protections already in the code

| Protection | Where |
|---|---|
| AES-256-GCM with a random IV per key and integrity check (auth tag) | `src/infrastructure/llm/utils/llm-crypto.util.ts` |
| Alias bound as authenticated data (prevents ciphertext swapping) | `encryptSecret` / `decryptSecret` |
| A key that fails authentication is refused and logged; its slot stays empty | `LlmKeyVaultService.createClient` |
| Decrypted keys never sent to the client or written back to the DB | `LlmKeyVaultService` ("decrypted keys never leave this process") |
| Provider error text scrubbed before logging or storing in `last_error` | `scrubSecrets` in `llm-client.service.ts` and `llm-metrics.service.ts` |
| Logger masks `gsk_...` patterns in log messages | `src/common/logger/logger.service.ts:19` |
| Master key validated at boot; if missing or invalid, AI features are disabled instead of running insecurely | `LlmCryptoService` constructor |

---

## 5. Risks to watch

### 5.1 Master key exposure (highest impact)

If `LLM_MASTER_ENCRYPTION_KEY` **and** the database both leak, every key is exposed.

- Limit who can view Vercel environment variables.
- Never commit `.env`. Keep `keys.json` git-ignored, and delete it after seeding.
- Never store the master key in the database, logs, tickets or chat.

### 5.2 Logging whole objects

A key lease (`KeyLease`) holds a Groq client, and the client holds the plaintext key. Logging a whole lease or client could leak it:

- The logger masks only the **message string**, not metadata objects.
- The mask only recognises Groq's `gsk_` key format.

**Rule:** log `lease.alias` or `lease.maskedKey`, never `lease`, `lease.client` or `vault.getRing()`.

### 5.3 Debugging tools in production

- Do not run production with `--inspect` or remote debugging enabled.
- Do not expose endpoints that produce heap snapshots or dump `process.env`.
- A memory dump contains the decrypted keys.

### 5.4 Switching LLM vendor

The redaction patterns (`gsk_` in `llm-crypto.util.ts` and `logger.service.ts`) are Groq-specific. A new provider must add its own key pattern to both.

### 5.5 Limiting damage if a key leaks

- Set spending and rate limits on each Groq account.
- If a leak is suspected, revoke the key in Groq, update `keys.json`, and run `npm run seed:llm-keys -- --prune`. Running servers detect the changed key set and reload automatically.

---

## 6. Optional future hardening

| Option | Benefit | Note |
|---|---|---|
| Store the master key in a cloud KMS (AWS KMS, GCP KMS) and use envelope encryption | Master key never sits in env vars; access is audited | API keys are still decrypted into memory to use them, so the startup approach stays the same |
| Master key rotation procedure | Limits exposure from an old leaked master key | Re-encrypt all rows with the new key via the seed script |
| Mask metadata in the logger, not only the message string | Closes the "logging whole objects" risk | Small change in `logger.service.ts` |

---

## 7. Conclusion

Decrypting every key into memory once at startup is the correct and standard design:

- It protects keys where they are most exposed: the database and its backups.
- It adds no per-request cost.
- It is no weaker than decrypting on demand.

The security of the system rests on keeping the **master key** and the **running server** protected. Section 5 lists the practices that matter.
