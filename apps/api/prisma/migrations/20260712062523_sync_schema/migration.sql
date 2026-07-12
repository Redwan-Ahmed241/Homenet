/*
  Warnings:

  - Made the column `analysis` on table `PropertyMedia` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "PropertyStatus" ADD VALUE 'pending';

-- AlterTable
ALTER TABLE "PropertyMedia" ALTER COLUMN "analysis" SET NOT NULL;
