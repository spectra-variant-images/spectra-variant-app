/**
 * Spectra App - Database Models and Queries
 * Handles product configuration, variant assignments, AI jobs
 */

import prisma from "../db.server";

export type VariantMediaMap = Record<string, string[]>; // variantGid -> mediaGids

// ============================================
// Product Configuration
// ============================================

export async function getProductConfiguration(shopId: string, shopifyProductId: bigint) {
  return prisma.spectraProduct.findUnique({
    where: {
      shopId_shopifyProductId: {
        shopId,
        shopifyProductId,
      },
    },
    include: {
      relations: true,
    },
  });
}

export async function upsertProductConfiguration(
  shopId: string,
  shopifyProductId: bigint,
  shopifyGid: string,
  data: {
    primaryOption?: string;
    swatchShape?: string;
    swatchSize?: string;
  }
) {
  return prisma.spectraProduct.upsert({
    where: {
      shopifyGid,
    },
    create: {
      shopId,
      shopifyProductId,
      shopifyGid,
      ...data,
    },
    update: {
      ...data,
      configuredAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function deleteProductConfiguration(shopifyGid: string) {
  return prisma.spectraProduct.delete({
    where: { shopifyGid },
  });
}

export async function listConfiguredProducts(
  shopId: string,
  params: { skip?: number; take?: number; search?: string }
) {
  const where: any = { shopId };

  if (params.search) {
    where.OR = [
      { shopifyGid: { contains: params.search } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.spectraProduct.findMany({
      where,
      skip: params.skip || 0,
      take: params.take || 50,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.spectraProduct.count({ where }),
  ]);

  return { products, total };
}

// ============================================
// Variant Media Assignments
// ============================================

export async function getVariantAssignments(productId: string) {
  return prisma.spectraAssignment.findMany({
    where: { productId },
    orderBy: { position: "asc" },
  });
}

export async function getVariantAssignment(
  productId: string,
  shopifyVariantGid: string
) {
  return prisma.spectraAssignment.findUnique({
    where: {
      shopifyVariantGid,
    },
  });
}

export async function upsertVariantAssignment(
  productId: string,
  shopifyVariantGid: string,
  shopifyVariantId: bigint,
  mediaIds: string[]
) {
  const assignment = await prisma.spectraAssignment.upsert({
    where: { shopifyVariantGid },
    create: {
      productId,
      shopifyVariantGid,
      shopifyVariantId,
      mediaIds: JSON.stringify(mediaIds),
      imageCount: mediaIds.length,
      isConfigured: mediaIds.length >= 2,
    },
    update: {
      mediaIds: JSON.stringify(mediaIds),
      imageCount: mediaIds.length,
      isConfigured: mediaIds.length >= 2,
      updatedAt: new Date(),
    },
  });

  // Update product configured status
  await updateProductConfigurationStatus(productId);

  return assignment;
}

export async function bulkUpsertAssignments(
  assignments: Array<{
    productId: string;
    shopifyVariantGid: string;
    shopifyVariantId: bigint;
    mediaIds: string[];
  }>
) {
  return prisma.$transaction(
    assignments.map((a) =>
      prisma.spectraAssignment.upsert({
        where: { shopifyVariantGid: a.shopifyVariantGid },
        create: {
          productId: a.productId,
          shopifyVariantGid: a.shopifyVariantGid,
          shopifyVariantId: a.shopifyVariantId,
          mediaIds: JSON.stringify(a.mediaIds),
          imageCount: a.mediaIds.length,
          isConfigured: a.mediaIds.length >= 2,
        },
        update: {
          mediaIds: JSON.stringify(a.mediaIds),
          imageCount: a.mediaIds.length,
          isConfigured: a.mediaIds.length >= 2,
        },
      })
    )
  );
}

export async function deleteVariantAssignment(shopifyVariantGid: string) {
  return prisma.spectraAssignment.delete({
    where: { shopifyVariantGid },
  });
}

async function updateProductConfigurationStatus(productId: string) {
  const assignments = await prisma.spectraAssignment.findMany({
    where: { productId },
  });

  const allConfigured = assignments.every((a) => a.isConfigured);
  const anyConfigured = assignments.some((a) => a.isConfigured);

  if (allConfigured && assignments.length > 0) {
    await prisma.spectraProduct.update({
      where: { id: productId },
      data: { configuredAt: new Date() },
    });
  }
}

// ============================================
// AI Jobs
// ============================================

export async function createAiJob(
  shopId: string,
  productIds: string[],
  options?: Record<string, unknown>
) {
  return prisma.spectraAiJob.create({
    data: {
      shopId,
      status: "queued",
      productIds: JSON.stringify(productIds),
      total: productIds.length,
      options: JSON.stringify(options || {}),
    },
  });
}

export async function getAiJob(jobId: string) {
  return prisma.spectraAiJob.findUnique({
    where: { id: jobId },
  });
}

export async function updateAiJob(
  jobId: string,
  data: {
    status?: string;
    progress?: number;
    results?: string;
    errors?: string;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
  }
) {
  return prisma.spectraAiJob.update({
    where: { id: jobId },
    data,
  });
}

export async function listAiJobs(
  shopId: string,
  params: { skip?: number; take?: number; status?: string }
) {
  const where: any = { shopId };

  if (params.status) {
    where.status = params.status;
  }

  return prisma.spectraAiJob.findMany({
    where,
    skip: params.skip || 0,
    take: params.take || 20,
    orderBy: { createdAt: "desc" },
  });
}

// ============================================
// Store Settings
// ============================================

export async function getStoreSettings(shopId: string) {
  return prisma.spectraStoreSettings.findUnique({
    where: { shopId },
  });
}

export async function upsertStoreSettings(
  shopId: string,
  data: {
    plan?: string;
    maxProducts?: number;
    aiQuotaAllocated?: number;
    featureCollectionSwatches?: boolean;
    featureBundles?: boolean;
  }
) {
  return prisma.spectraStoreSettings.upsert({
    where: { shopId },
    create: {
      shopId,
      ...data,
      aiQuotaResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    update: data,
  });
}

export async function incrementAiUsage(shopId: string, imageCount: number) {
  return prisma.spectraStoreSettings.update({
    where: { shopId },
    data: {
      aiQuotaUsed: { increment: imageCount },
    },
  });
}

export async function incrementProductCount(shopId: string) {
  const settings = await getStoreSettings(shopId);
  if (!settings || settings.productCount < settings.maxProducts) {
    return prisma.spectraStoreSettings.update({
      where: { shopId },
      data: {
        productCount: { increment: 1 },
      },
    });
  }
  throw new Error("Product limit reached for current plan");
}

export async function decrementProductCount(shopId: string) {
  return prisma.spectraStoreSettings.update({
    where: { shopId },
    data: {
      productCount: { decrement: 1 },
    },
  });
}

// ============================================
// Color Dictionary (AI learning)
// ============================================

export async function learnColor(
  shopId: string,
  name: string,
  language: string,
  hexCode?: string
) {
  return prisma.spectraColorDictionary.upsert({
    where: {
      shopId_name_language: {
        shopId,
        name,
        language,
      },
    },
    create: {
      shopId,
      name,
      language,
      hexCodes: hexCode ? JSON.stringify([hexCode]) : null,
      frequency: 1,
    },
    update: {
      frequency: { increment: 1 },
    },
  });
}

export async function getColorDictionary(shopId: string) {
  return prisma.spectraColorDictionary.findMany({
    where: { shopId },
    orderBy: { frequency: "desc" },
  });
}

// ============================================
// Helpers
// ============================================

export function parseMediaIds(jsonString: string | null): string[] {
  if (!jsonString) return [];
  try {
    return JSON.parse(jsonString);
  } catch {
    return [];
  }
}

export function stringifyMediaIds(ids: string[]): string {
  return JSON.stringify(ids);
}

export async function getProductConfigurationSummary(productId: string) {
  const assignments = await prisma.spectraAssignment.findMany({
    where: { productId },
  });

  const total = assignments.length;
  const configured = assignments.filter((a) => a.isConfigured).length;
  const partial = assignments.filter((a) => a.imageCount === 1).length;
  const empty = assignments.filter((a) => a.imageCount === 0).length;

  return {
    total,
    configured,
    partial,
    empty,
    percentage: total > 0 ? Math.round((configured / total) * 100) : 0,
  };
}
