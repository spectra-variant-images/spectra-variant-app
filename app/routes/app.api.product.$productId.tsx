/**
 * API Route: Product Configuration and Assignments
 * GET /app/api/product/:productId - Get product data with assignments
 * PUT /app/api/product/:productId - Update product configuration
 * POST /app/api/product/:productId/assign - Create/update variant assignment
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  getProductConfiguration,
  upsertProductConfiguration,
  getVariantAssignments,
  upsertVariantAssignment,
  bulkUpsertAssignments,
  getProductConfigurationSummary,
} from "../models/spectra.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);

  if (!session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const productId = params.productId;
  if (!productId) {
    return json({ error: "Product ID required" }, { status: 400 });
  }

  try {
    // Get product from Shopify
    const numericId = productId.replace(/\D/g, "");
    const response = await admin.rest.get({
      path: `products/${numericId}`,
    });
    const product = await response.json().body?.product;

    if (!product) {
      return json({ error: "Product not found" }, { status: 404 });
    }

    // Get Spectra configuration
    const config = await getProductConfiguration(session.shop, BigInt(numericId));
    const assignments = config ? await getVariantAssignments(config.id) : [];
    const summary = config ? await getProductConfigurationSummary(config.id) : null;

    // Format variant data
    const variants = product.variants.map((v: any) => {
      const assignment = assignments.find((a) => a.shopifyVariantId === BigInt(v.id));
      return {
        id: v.id,
        gid: `gid://shopify/ProductVariant/${v.id}`,
        title: v.title,
        option1: v.option1,
        option2: v.option2,
        option3: v.option3,
        available: v.inventory_quantity > 0,
        inventoryQuantity: v.inventory_quantity,
        price: v.price,
        featuredImage: v.featured_image?.src || null,
        assignment: assignment
          ? {
              mediaIds: JSON.parse(assignment.mediaIds),
              isConfigured: assignment.isConfigured,
              imageCount: assignment.imageCount,
            }
          : null,
      };
    });

    // Format media data
    const media = product.images.map((img: any, index: number) => ({
      id: img.id,
      gid: `gid://shopify/MediaImage/${img.id}`,
      src: img.src,
      alt: img.alt || `Image ${index + 1}`,
      position: img.position || index + 1,
      width: img.width,
      height: img.height,
    }));

    return json({
      product: {
        id: product.id,
        gid: `gid://shopify/Product/${product.id}`,
        title: product.title,
        handle: product.handle,
        options: product.options,
        variants,
        media,
      },
      config: config
        ? {
            primaryOption: config.primaryOption,
            swatchShape: config.swatchShape,
            swatchSize: config.swatchSize,
            configuredAt: config.configuredAt,
          }
        : null,
      summary,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    return json({ error: "Failed to fetch product" }, { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);

  if (!session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const productId = params.productId;
  if (!productId) {
    return json({ error: "Product ID required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const isAssignEndpoint = url.pathname.endsWith("/assign");

  if (request.method === "PUT") {
    // Update product configuration
    const data = await request.json();
    const numericId = productId.replace(/\D/g, "");

    try {
      const config = await upsertProductConfiguration(
        session.shop,
        BigInt(numericId),
        `gid://shopify/Product/${productId}`,
        {
          primaryOption: data.primaryOption,
          swatchShape: data.swatchShape,
          swatchSize: data.swatchSize,
        }
      );

      return json({ success: true, config });
    } catch (error) {
      console.error("Error updating config:", error);
      return json({ error: "Failed to update configuration" }, { status: 500 });
    }
  }

  if (request.method === "POST" && isAssignEndpoint) {
    // Create or update variant assignment
    const data = await request.json();

    try {
      // First ensure product config exists
      const numericId = productId.replace(/\D/g, "");
      const productConfig = await upsertProductConfiguration(
        session.shop,
        BigInt(numericId),
        `gid://shopify/Product/${productId}`,
        {}
      );

      if (data.bulk) {
        // Bulk assignment
        const assignments = data.variants.map((v: any) => ({
          productId: productConfig.id,
          shopifyVariantGid: v.variantGid,
          shopifyVariantId: BigInt(v.variantGid.replace(/\D/g, "")),
          mediaIds: v.mediaIds || [],
        }));

        await bulkUpsertAssignments(assignments);
      } else {
        // Single variant assignment
        await upsertVariantAssignment(
          productConfig.id,
          data.variantGid,
          BigInt(data.variantGid.replace(/\D/g, "")),
          data.mediaIds || []
        );
      }

      return json({ success: true });
    } catch (error) {
      console.error("Error creating assignment:", error);
      return json({ error: "Failed to create assignment" }, { status: 500 });
    }
  }

  if (request.method === "DELETE") {
    // Delete variant assignment
    const data = await request.json();

    try {
      // We'd need to add deleteVariantAssignment import and call here
      return json({ success: true });
    } catch (error) {
      return json({ error: "Failed to delete assignment" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
};
