-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('residential', 'commercial', 'land', 'parking');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('sale', 'rent');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('draft', 'active', 'sold', 'archived');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "PropertyType" NOT NULL DEFAULT 'residential',
    "subtype" TEXT,
    "listing_type" "ListingType" NOT NULL DEFAULT 'sale',
    "price" DOUBLE PRECISION NOT NULL,
    "price_currency" TEXT NOT NULL DEFAULT 'BDT',
    "area_size" DOUBLE PRECISION,
    "area_unit" TEXT DEFAULT 'sqft',
    "location_lat" DOUBLE PRECISION,
    "location_lng" DOUBLE PRECISION,
    "address" TEXT,
    "amenities" JSONB,
    "status" "PropertyStatus" NOT NULL DEFAULT 'draft',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "virtual_tour_url" TEXT,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMedia" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL DEFAULT 'image',
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "analysis" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_user_id_idx" ON "Property"("user_id");
CREATE INDEX "Property_area_id_idx" ON "Property"("area_id");
CREATE INDEX "Property_status_idx" ON "Property"("status");
CREATE INDEX "Property_type_idx" ON "Property"("type");
CREATE INDEX "Property_listing_type_idx" ON "Property"("listing_type");
CREATE INDEX "Property_price_idx" ON "Property"("price");
CREATE INDEX "Property_published_at_idx" ON "Property"("published_at");

-- CreateIndex
CREATE INDEX "PropertyMedia_property_id_idx" ON "PropertyMedia"("property_id");
CREATE INDEX "PropertyMedia_display_order_idx" ON "PropertyMedia"("display_order");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
