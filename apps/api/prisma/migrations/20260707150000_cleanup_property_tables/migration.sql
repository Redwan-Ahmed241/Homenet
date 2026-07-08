-- Drop tables that are no longer needed (only keep Property & PropertyMedia)
DROP TABLE IF EXISTS "PropertyBoost" CASCADE;
DROP TABLE IF EXISTS "VerificationDocument" CASCADE;
DROP TABLE IF EXISTS "PropertyVerification" CASCADE;

-- Drop unused enums
DROP TYPE IF EXISTS "DocumentType" CASCADE;
DROP TYPE IF EXISTS "VerificationStatus" CASCADE;
