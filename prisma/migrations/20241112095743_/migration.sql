-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "originalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "originalFee" DOUBLE PRECISION NOT NULL DEFAULT 0;
