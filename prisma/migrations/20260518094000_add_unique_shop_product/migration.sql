-- AlterTable
ALTER TABLE "SpectraProduct" DROP COLUMN "configuredAt";

-- AlterTable
ALTER TABLE "SpectraProduct" ADD COLUMN "configuredAt" TEXT;

-- AlterTable
CREATE UNIQUE INDEX "SpectraProduct_shopId_shopifyProductId_key" ON "SpectraProduct"("shopId", "shopifyProductId");
