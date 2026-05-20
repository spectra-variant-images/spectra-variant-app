-- CreateTable
CREATE TABLE "SpectraProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" BIGINT NOT NULL,
    "shopifyGid" TEXT NOT NULL,
    "configuredAt" DATETIME,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "primaryOption" TEXT,
    "swatchShape" TEXT NOT NULL DEFAULT 'circle',
    "swatchSize" TEXT NOT NULL DEFAULT 'medium',
    "aiJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpectraAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "shopifyVariantGid" TEXT NOT NULL,
    "shopifyVariantId" BIGINT NOT NULL,
    "mediaIds" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpectraAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SpectraProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpectraAiJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "productIds" TEXT NOT NULL,
    "options" TEXT,
    "results" TEXT,
    "errors" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "failedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpectraStoreSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "maxProducts" INTEGER NOT NULL DEFAULT 1,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "aiQuotaAllocated" INTEGER NOT NULL DEFAULT 100,
    "aiQuotaUsed" INTEGER NOT NULL DEFAULT 0,
    "aiQuotaResetAt" DATETIME NOT NULL,
    "featureCollectionSwatches" BOOLEAN NOT NULL DEFAULT false,
    "featureBundles" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpectraColorDictionary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "hexCodes" TEXT,
    "aliases" TEXT,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_SpectraAiJobToSpectraProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_SpectraAiJobToSpectraProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "SpectraAiJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_SpectraAiJobToSpectraProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "SpectraProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SpectraProduct_shopifyGid_key" ON "SpectraProduct"("shopifyGid");

-- CreateIndex
CREATE INDEX "SpectraProduct_shopId_idx" ON "SpectraProduct"("shopId");

-- CreateIndex
CREATE INDEX "SpectraProduct_shopifyProductId_idx" ON "SpectraProduct"("shopifyProductId");

-- CreateIndex
CREATE INDEX "SpectraAssignment_productId_idx" ON "SpectraAssignment"("productId");

-- CreateIndex
CREATE INDEX "SpectraAssignment_shopifyVariantId_idx" ON "SpectraAssignment"("shopifyVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "SpectraAssignment_shopifyVariantGid_key" ON "SpectraAssignment"("shopifyVariantGid");

-- CreateIndex
CREATE INDEX "SpectraAiJob_shopId_idx" ON "SpectraAiJob"("shopId");

-- CreateIndex
CREATE INDEX "SpectraAiJob_status_idx" ON "SpectraAiJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SpectraStoreSettings_shopId_key" ON "SpectraStoreSettings"("shopId");

-- CreateIndex
CREATE INDEX "SpectraStoreSettings_shopId_idx" ON "SpectraStoreSettings"("shopId");

-- CreateIndex
CREATE INDEX "SpectraColorDictionary_shopId_idx" ON "SpectraColorDictionary"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "SpectraColorDictionary_shopId_name_language_key" ON "SpectraColorDictionary"("shopId", "name", "language");

-- CreateIndex
CREATE UNIQUE INDEX "_SpectraAiJobToSpectraProduct_AB_unique" ON "_SpectraAiJobToSpectraProduct"("A", "B");

-- CreateIndex
CREATE INDEX "_SpectraAiJobToSpectraProduct_B_index" ON "_SpectraAiJobToSpectraProduct"("B");
