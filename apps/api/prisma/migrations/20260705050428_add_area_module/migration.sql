-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_area_id" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Dhaka',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Area_parent_area_id_idx" ON "Area"("parent_area_id");

-- CreateIndex
CREATE INDEX "Area_city_idx" ON "Area"("city");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_parent_area_id_fkey" FOREIGN KEY ("parent_area_id") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
