-- Applied manually (Neon SQL console or `npx prisma db execute --file <this file>`).
-- Not a Prisma migration: do not move into prisma/migrations. Safe to re-run.

CREATE TABLE IF NOT EXISTS llm_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_alias VARCHAR(50) UNIQUE NOT NULL,
    account_id VARCHAR(50) NOT NULL,
    masked_key VARCHAR(20) NOT NULL,
    encrypted_key TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(40) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,

    success_count INT DEFAULT 0 NOT NULL,
    failure_count INT DEFAULT 0 NOT NULL,
    last_success_at TIMESTAMPTZ,
    last_failed_at TIMESTAMPTZ,
    last_error TEXT,
    cooldown_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_keys_status ON llm_api_keys(status);
CREATE INDEX IF NOT EXISTS idx_llm_keys_cooldown ON llm_api_keys(cooldown_until);
CREATE INDEX IF NOT EXISTS idx_llm_keys_account ON llm_api_keys(account_id);

-- Shared round-robin counter: every LLM call takes nextval(), so all Vercel instances follow one order.
CREATE SEQUENCE IF NOT EXISTS llm_rotation_seq;
