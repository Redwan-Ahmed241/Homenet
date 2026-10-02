-- CreateTable
CREATE TABLE "llm_api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key_alias" VARCHAR(50) NOT NULL,
    "account_id" VARCHAR(50) NOT NULL,
    "masked_key" VARCHAR(20) NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "iv" VARCHAR(32) NOT NULL,
    "auth_tag" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_success_at" TIMESTAMPTZ(6),
    "last_failed_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "cooldown_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "llm_api_keys_key_alias_key" ON "llm_api_keys"("key_alias");

-- CreateIndex
CREATE INDEX "idx_llm_keys_status" ON "llm_api_keys"("status");

-- CreateIndex
CREATE INDEX "idx_llm_keys_cooldown" ON "llm_api_keys"("cooldown_until");

-- CreateIndex
CREATE INDEX "idx_llm_keys_account" ON "llm_api_keys"("account_id");

-- CreateSequence
-- Shared round-robin counter for LLM key rotation: every call takes nextval(), so all instances follow one order.
-- Not expressible in schema.prisma, so it is maintained here by hand.
CREATE SEQUENCE "llm_rotation_seq";
