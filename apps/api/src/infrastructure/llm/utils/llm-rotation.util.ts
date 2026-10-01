interface RingCandidate {
  account_id: string;
  key_alias: string;
}

/**
 * Orders keys as A1-k1, A2-k1, …, An-k1, A1-k2, … so consecutive calls land on different accounts.
 * The order is deterministic, so every instance maps the shared counter to the same key.
 */
export function buildInterleavedRing<T extends RingCandidate>(
  rows: readonly T[],
): T[] {
  const byAccount = new Map<string, T[]>();
  for (const row of [...rows].sort((a, b) =>
    a.key_alias.localeCompare(b.key_alias),
  )) {
    const keys = byAccount.get(row.account_id) ?? [];
    keys.push(row);
    byAccount.set(row.account_id, keys);
  }

  const accounts = [...byAccount.keys()].sort((a, b) => a.localeCompare(b));
  const depth = Math.max(0, ...accounts.map((a) => byAccount.get(a)!.length));
  const ring: T[] = [];
  for (let round = 0; round < depth; round++) {
    for (const account of accounts) {
      const key = byAccount.get(account)![round];
      if (key) ring.push(key);
    }
  }
  return ring;
}

/** Starts at `counter mod size` and walks forward to the first eligible slot. */
export function pickSlotIndex(
  size: number,
  counter: number,
  isEligible: (index: number) => boolean,
): number | null {
  if (size <= 0) return null;
  const start = ((counter % size) + size) % size;
  for (let step = 0; step < size; step++) {
    const index = (start + step) % size;
    if (isEligible(index)) return index;
  }
  return null;
}

/** Parses Groq durations such as "1m26s", "7.66s", "250ms", "1h2m" or a plain seconds value ("60"). */
export function parseDurationSeconds(
  value: string | null | undefined,
): number | null {
  const text = value?.trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.max(1, Math.ceil(Number(text)));

  let totalSeconds = 0;
  let consumed = '';
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    consumed += match[0];
    const amount = Number(match[1]);
    const unit = match[2];
    totalSeconds +=
      unit === 'h'
        ? amount * 3600
        : unit === 'm'
          ? amount * 60
          : unit === 's'
            ? amount
            : amount / 1000;
  }
  if (consumed !== text) return null;
  return Math.max(1, Math.ceil(totalSeconds));
}
