-- CreateEnum
CREATE TYPE "UserAssetSource" AS ENUM ('AVATAR', 'NID');

-- CreateTable
CREATE TABLE "UserAsset" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "source" "UserAssetSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAsset_user_id_idx" ON "UserAsset"("user_id");

-- CreateIndex
CREATE INDEX "UserAsset_asset_id_idx" ON "UserAsset"("asset_id");

-- CreateIndex
CREATE INDEX "UserAsset_source_idx" ON "UserAsset"("source");

-- AddForeignKey
ALTER TABLE "UserAsset" ADD CONSTRAINT "UserAsset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
