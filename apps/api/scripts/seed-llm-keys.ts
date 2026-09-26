/**
 * Encrypts plaintext Groq keys from a git-ignored JSON file and upserts them into llm_api_keys.
 *
 *   npm run seed:llm-keys                      # reads ./keys.json
 *   npm run seed:llm-keys -- other.keys.json   # custom file
 *   npm run seed:llm-keys -- --prune           # also delete rows whose alias is not in the file
 *
 * File format: [{ "alias": "llm-key-01", "account_id": "acct-01", "key": "gsk_..." }]
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import {
  decryptSecret,
  encryptSecret,
  maskKey,
  parseMasterKey,
  type EncryptedSecret,
} from '../src/modules/ai/llm/llm-crypto.util';

interface KeyEntry {
  alias: string;
  account_id: string;
  key: string;
}

const IDENTIFIER = /^[A-Za-z0-9_-]{1,50}$/;
const prisma = new PrismaClient();

function readEntries(filePath: string): KeyEntry[] {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${filePath} must contain a non-empty JSON array`);
  }

  const seen = new Set<string>();
  return parsed.map((item, index) => {
    const { alias, account_id, key } = (item ?? {}) as Record<string, unknown>;
    if (typeof alias !== 'string' || !IDENTIFIER.test(alias)) {
      throw new Error(
        `Entry ${index}: "alias" must be 1-50 letters, digits, "_" or "-"`,
      );
    }
    if (typeof account_id !== 'string' || !IDENTIFIER.test(account_id)) {
      throw new Error(
        `Entry ${index} (${alias}): "account_id" must be 1-50 letters, digits, "_" or "-"`,
      );
    }
    if (typeof key !== 'string' || key.trim().length < 16) {
      throw new Error(
        `Entry ${index} (${alias}): "key" is missing or too short`,
      );
    }
    if (seen.has(alias)) {
      throw new Error(`Duplicate alias "${alias}"`);
    }
    seen.add(alias);
    return { alias, account_id, key: key.trim() };
  });
}

function tryDecrypt(
  secret: EncryptedSecret,
  alias: string,
  masterKey: Buffer,
): string | null {
  try {
    return decryptSecret(secret, alias, masterKey);
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = path.resolve(
    args.find((arg) => !arg.startsWith('--')) ?? 'keys.json',
  );
  const prune = args.includes('--prune');

  const masterKey = parseMasterKey(process.env.LLM_MASTER_ENCRYPTION_KEY);
  const entries = readEntries(filePath);
  console.log(
    `Seeding ${entries.length} LLM keys from ${path.basename(filePath)}...`,
  );

  const counts = { created: 0, updated: 0, unchanged: 0 };

  for (const entry of entries) {
    const existing = await prisma.llmApiKey.findUnique({
      where: { key_alias: entry.alias },
    });
    const existingKey = existing
      ? tryDecrypt(existing, entry.alias, masterKey)
      : null;

    if (
      existing &&
      existingKey === entry.key &&
      existing.account_id === entry.account_id
    ) {
      counts.unchanged++;
      console.log(
        `  = ${entry.alias} (${entry.account_id}) ${existing.masked_key} unchanged`,
      );
      continue;
    }

    const secret = encryptSecret(entry.key, entry.alias, masterKey);
    const fields = {
      account_id: entry.account_id,
      masked_key: maskKey(entry.key),
      ...secret,
    };
    // A new key starts clean; moving an unchanged key to another account keeps its status.
    const resetState =
      existingKey !== entry.key
        ? { status: 'ACTIVE', cooldown_until: null, last_error: null }
        : {};

    await prisma.llmApiKey.upsert({
      where: { key_alias: entry.alias },
      create: { key_alias: entry.alias, ...fields },
      update: { ...fields, ...resetState },
    });

    const stored = await prisma.llmApiKey.findUniqueOrThrow({
      where: { key_alias: entry.alias },
    });
    if (tryDecrypt(stored, entry.alias, masterKey) !== entry.key) {
      throw new Error(
        `Round-trip decryption check failed for "${entry.alias}"`,
      );
    }

    counts[existing ? 'updated' : 'created']++;
    console.log(
      `  ✓ ${entry.alias} (${entry.account_id}) ${fields.masked_key} ${existing ? 'updated' : 'created'}`,
    );
  }

  const aliases = entries.map((entry) => entry.alias);
  const extras = await prisma.llmApiKey.findMany({
    where: { key_alias: { notIn: aliases } },
    select: { key_alias: true },
  });
  if (extras.length > 0) {
    const names = extras.map((row) => row.key_alias).join(', ');
    if (prune) {
      await prisma.llmApiKey.deleteMany({
        where: { key_alias: { notIn: aliases } },
      });
      console.log(
        `  ✗ Deleted ${extras.length} key(s) not in the file: ${names}`,
      );
    } else {
      console.log(
        `  ! ${extras.length} key(s) in the database are not in the file (re-run with --prune to delete): ${names}`,
      );
    }
  }

  console.log(
    `Done: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged.`,
  );
}

main()
  .catch((error: Error) => {
    console.error(`Seeding failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
