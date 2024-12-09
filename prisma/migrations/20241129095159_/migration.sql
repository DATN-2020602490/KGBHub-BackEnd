/*
  Warnings:

  - You are about to drop the column `discount` on the `CampaignDiscount` table. All the data in the column will be lost.
  - Added the required column `value` to the `CampaignDiscount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CampaignDiscount" DROP COLUMN "discount",
ADD COLUMN     "value" DOUBLE PRECISION NOT NULL;
