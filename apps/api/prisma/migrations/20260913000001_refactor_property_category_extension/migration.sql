-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('real_estate', 'short_stay');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- AlterTable: Add category column to Property
ALTER TABLE "Property" ADD COLUMN "category" "ListingCategory" NOT NULL DEFAULT 'real_estate';

-- CreateTable: RealEstateDetail
CREATE TABLE "RealEstateDetail" (
    "property_id" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "listing_type" "ListingType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "price_currency" TEXT NOT NULL DEFAULT 'BDT',
    "area_size" DOUBLE PRECISION,
    "area_unit" TEXT DEFAULT 'sqft',

    CONSTRAINT "RealEstateDetail_pkey" PRIMARY KEY ("property_id")
);

-- Data Migration: Backfill RealEstateDetail from existing Property rows before dropping columns
INSERT INTO "RealEstateDetail" ("property_id", "type", "listing_type", "price", "price_currency", "area_size", "area_unit")
SELECT "id", "type", "listing_type", "price", "price_currency", "area_size", "area_unit"
FROM "Property";

-- Drop obsolete indexes from Property
DROP INDEX IF EXISTS "Property_type_idx";
DROP INDEX IF EXISTS "Property_listing_type_idx";
DROP INDEX IF EXISTS "Property_price_idx";

-- Drop transferred columns from Property
ALTER TABLE "Property" DROP COLUMN "type";
ALTER TABLE "Property" DROP COLUMN "listing_type";
ALTER TABLE "Property" DROP COLUMN "price";
ALTER TABLE "Property" DROP COLUMN "price_currency";
ALTER TABLE "Property" DROP COLUMN "area_size";
ALTER TABLE "Property" DROP COLUMN "area_unit";

-- Create new index on Property(category)
CREATE INDEX "Property_category_idx" ON "Property"("category");

-- CreateTable: ShortStayDetail
CREATE TABLE "ShortStayDetail" (
    "property_id" TEXT NOT NULL,
    "nightly_rate" DOUBLE PRECISION NOT NULL,
    "price_currency" TEXT NOT NULL DEFAULT 'BDT',
    "max_guests" INTEGER NOT NULL,
    "min_nights" INTEGER NOT NULL DEFAULT 1,
    "check_in_time" TEXT,
    "check_out_time" TEXT,

    CONSTRAINT "ShortStayDetail_pkey" PRIMARY KEY ("property_id")
);

-- CreateTable: ShortStayBooking
CREATE TABLE "ShortStayBooking" (
    "id" TEXT NOT NULL,
    "detail_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "check_in" TIMESTAMP(3) NOT NULL,
    "check_out" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortStayBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: RealEstateDetail
CREATE INDEX "RealEstateDetail_type_idx" ON "RealEstateDetail"("type");
CREATE INDEX "RealEstateDetail_listing_type_idx" ON "RealEstateDetail"("listing_type");
CREATE INDEX "RealEstateDetail_price_idx" ON "RealEstateDetail"("price");

-- CreateIndex: ShortStayDetail
CREATE INDEX "ShortStayDetail_nightly_rate_idx" ON "ShortStayDetail"("nightly_rate");

-- CreateIndex: ShortStayBooking
CREATE INDEX "ShortStayBooking_detail_id_idx" ON "ShortStayBooking"("detail_id");
CREATE INDEX "ShortStayBooking_check_in_check_out_idx" ON "ShortStayBooking"("check_in", "check_out");
CREATE INDEX "ShortStayBooking_user_id_idx" ON "ShortStayBooking"("user_id");

-- AddForeignKey: RealEstateDetail -> Property
ALTER TABLE "RealEstateDetail" ADD CONSTRAINT "RealEstateDetail_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ShortStayDetail -> Property
ALTER TABLE "ShortStayDetail" ADD CONSTRAINT "ShortStayDetail_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ShortStayBooking -> ShortStayDetail
ALTER TABLE "ShortStayBooking" ADD CONSTRAINT "ShortStayBooking_detail_id_fkey" FOREIGN KEY ("detail_id") REFERENCES "ShortStayDetail"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ShortStayBooking -> User
ALTER TABLE "ShortStayBooking" ADD CONSTRAINT "ShortStayBooking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
