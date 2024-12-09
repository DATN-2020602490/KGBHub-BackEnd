-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "discountFrom" DOUBLE PRECISION,
ADD COLUMN     "discountTo" DOUBLE PRECISION,
ADD COLUMN     "feeVoucherValue" DOUBLE PRECISION,
ADD COLUMN     "productVoucherValue" DOUBLE PRECISION,
ADD COLUMN     "totalFeeVoucher" INTEGER,
ADD COLUMN     "totalProductVoucher" INTEGER;
