/**
 * Product Detail Editor
 * Assign images to variants with drag-drop reordering
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher, Form } from "@remix-run/react";
import { useState, useCallback, useMemo } from "react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  LegacyStack,
  Thumbnail,
  Badge,
  Banner,
  InlineStack,
  BlockStack,
  TextField,
  Icon,
} from "@shopify/polaris";
import {
  ArrowLeftIcon,
  CheckIcon,
  ImageIcon,
  CircleIcon,
} from "@shopify/polaris-icons";
import * as models from "~/models/spectra.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const productId = params.id;

  // Fetch product with variants and media
  const response = await admin.graphql(
    `#graphql
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        description
        featuredImage {
          url
          altText
        }
        options {
          id
          name
          position
          values
        }
        variants(first: 100) {
          edges {
            node {
              id
              title
              displayName
              sku
              availableForSale
              price {
                amount
                currencyCode
              }
              selectedOptions {
                name
                value
              }
              image {
                url
                altText
              }
            }
          }
        }
        media(first: 250) {
          edges {
            node {
              mediaId
              mediaContentType
              image {
                url
                altText
                width
                height
              }
              video {
                url
              }
            }
          }
        }
      }
    }
    `,
    { variables: { id: `gid://shopify/Product/${productId}` } }
  );

  const result = await response.json();
  const shopifyProduct = result.data?.product;

  if (!shopifyProduct) {
    throw new Response("Product not found", { status: 404 });
  }

  // Get Spectra configuration from our database
  const shopId = session.shop;
  let spectraConfig = null;
  let assignments: any[] = [];

  try {
    const numericId = BigInt(productId);
    spectraConfig = await models.getProductConfiguration(shopId, numericId);
    if (spectraConfig) {
      assignments = spectraConfig.relations || [];
    }
  } catch (e) {
    // Product not yet configured
  }

  // Transform data for frontend
  const variants = shopifyProduct.variants.edges.map((edge: any) => {
    const variant = edge.node;
    const assignment = assignments.find((a: any) => a.shopifyVariantGid === variant.id);

    // Extract numeric variant ID
    const variantIdMatch = variant.id.match(/ProductVariant\/(\d+)/);
    const variantId = variantIdMatch ? variantIdMatch[1] : variant.id;

    return {
      id: variantId,
      gid: variant.id,
      title: variant.title,
      displayName: variant.displayName,
      sku: variant.sku,
      available: variant.availableForSale,
      price: variant.price,
      image: variant.image?.url,
      options: variant.selectedOptions,
      assignment: assignment ? {
        mediaIds: models.parseMediaIds(assignment.mediaIds),
        isConfigured: assignment.isConfigured,
        imageCount: assignment.imageCount,
      } : null,
    };
  });

  const media = shopifyProduct.media.edges.map((edge: any, index: number) => {
    const node = edge.node;
    const mediaIdMatch = node.mediaId.match(/MediaImage\/(\d+)/);
    const mediaId = mediaIdMatch ? mediaIdMatch[1] : node.mediaId;

    let url = "";
    let alt = "";

    if (node.image) {
      url = node.image.url;
      alt = node.image.altText || "";
    } else if (node.video) {
      url = node.video.url || "";
      alt = "Video";
    }

    return {
      id: mediaId,
      gid: node.mediaId,
      url,
      alt,
      type: node.mediaContentType,
      position: index,
    };
  });

  // Calculate summary
  const totalVariants = variants.length;
  const configuredVariants = variants.filter((v: any) => v.assignment?.isConfigured).length;
  const partialVariants = variants.filter((v: any) => v.assignment && !v.assignment.isConfigured).length;
  const emptyVariants = variants.filter((v: any) => !v.assignment).length;

  return json({
    product: {
      id: productId,
      gid: shopifyProduct.id,
      title: shopifyProduct.title,
      handle: shopifyProduct.handle,
      description: shopifyProduct.description,
      featuredImage: shopifyProduct.featuredImage?.url,
    },
    variants,
    media,
    options: shopifyProduct.options,
    summary: {
      total: totalVariants,
      configured: configuredVariants,
      partial: partialVariants,
      empty: emptyVariants,
      percentage: totalVariants > 0 ? Math.round((configuredVariants / totalVariants) * 100) : 0,
    },
    globalMedia: spectraConfig?.globalMedia ? JSON.parse(spectraConfig.globalMedia) : [],
  });
};

export const action = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const productId = params.id;
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  const shopId = session.shop;
  const productGid = `gid://shopify/Product/${productId}`;

  if (actionType === "save-assignment") {
    const variantGid = formData.get("variantGid") as string;
    const mediaIdsJson = formData.get("mediaIds") as string;
    const mediaIds = JSON.parse(mediaIdsJson);

    try {
      await models.upsertVariantAssignment(
        shopId,
        productGid,
        BigInt(productId),
        mediaIds
      );

      // Mark product as configured if this is first assignment
      const config = await models.getProductConfiguration(shopId, BigInt(productId));
      if (!config?.configuredAt) {
        await models.upsertProductConfiguration(shopId, BigInt(productId), productGid, {});
      }

      return json({ success: true });
    } catch (error: any) {
      return json({ error: error.message }, { status: 400 });
    }
  }

  if (actionType === "save-global") {
    const mediaIdsJson = formData.get("mediaIds") as string;
    const mediaIds = JSON.parse(mediaIdsJson);

    try {
      const config = await models.upsertProductConfiguration(shopId, BigInt(productId), productGid, {
        globalMedia: mediaIds,
      });
      return json({ success: true });
    } catch (error: any) {
      return json({ error: error.message }, { status: 400 });
    }
  }

  if (actionType === "ai-assign") {
    // Create AI job for this product
    try {
      const job = await models.createAiJob(shopId, [productGid], {
        autoApply: false,
      });
      return json({ success: true, jobId: job.id });
    } catch (error: any) {
      return json({ error: error.message }, { status: 400 });
    }
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function ProductDetailPage() {
  const { product, variants, media, options, summary, globalMedia } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants[0]?.id || null
  );
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());

  const selectedVariant = variants.find((v: any) => v.id === selectedVariantId);

  // Determine which option is "visual" (likely Color)
  const visualOption = options?.find((o: any) =>
    o.name.toLowerCase().includes("color") ||
    o.name.toLowerCase().includes("colour")
  );

  // Group variants by visual option for easier navigation
  const variantGroups = useMemo(() => {
    if (!visualOption) return [{ name: "All Variants", variants }];

    return visualOption.values.map((value: string) => ({
      name: value,
      variants: variants.filter((v: any) =>
        v.options.some((o: any) => o.name === visualOption.name && o.value === value)
      ),
    }));
  }, [variants, visualOption, options]);

  const handleVariantSelect = useCallback((variantId: string) => {
    const variant = variants.find((v: any) => v.id === variantId);
    setSelectedVariantId(variantId);

    // Load assigned media for this variant
    if (variant?.assignment?.mediaIds) {
      setSelectedMediaIds(new Set(variant.assignment.mediaIds.map((m: any) => m)));
    } else {
      setSelectedMediaIds(new Set());
    }
  }, [variants]);

  const handleMediaToggle = useCallback((mediaId: string) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedVariant) return;

    fetcher.submit(
      {
        actionType: "save-assignment",
        variantGid: selectedVariant.gid,
        mediaIds: JSON.stringify(Array.from(selectedMediaIds)),
      },
      { method: "post" }
    );
  }, [selectedVariant, selectedMediaIds, fetcher]);

  const handleGlobalToggle = useCallback((mediaId: string) => {
    const currentGlobals = new Set(globalMedia || []);
    fetcher.submit(
      {
        actionType: "save-global",
        mediaIds: JSON.stringify(
          currentGlobals.has(mediaId)
            ? globalMedia.filter((id: string) => id !== mediaId)
            : [...globalMedia, mediaId]
        ),
      },
      { method: "post" }
    );
  }, [globalMedia, fetcher]);

  const isGlobalMedia = (mediaId: string) => (globalMedia || []).includes(mediaId);

  return (
    <Page
      title={product.title}
      subtitle={summary.percentage === 100 ? "Fully configured" : `${summary.percentage}% configured`}
      backAction={{ content: "Products", url: "/app/products" }}
      primaryAction={{
        content: "Save Changes",
        onAction: handleSave,
        disabled: fetcher.state === "submitting",
        loading: fetcher.state === "submitting",
      }}
      secondaryActions={[
        {
          content: "AI Auto-Assign",
          icon: ImageIcon,
          onAction: () => {
            fetcher.submit(
              { actionType: "ai-assign" },
              { method: "post" }
            );
          },
        },
      ]}
    >
      <Layout>
        {/* Summary Banner */}
        <Layout.Section>
          <Banner status={summary.percentage === 100 ? "success" : "info"}>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                {summary.configured} variants fully configured, {summary.partial} partially configured,
                {summary.empty} not configured.
              </Text>
              {summary.percentage < 100 && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Tip: Assign at least 2 images per variant for the best customer experience.
                </Text>
              )}
            </BlockStack>
          </Banner>
        </Layout.Section>

        {/* Main Content */}
        <Layout.Section variant="oneHalf">
          {/* Media Gallery */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Media Gallery
                </Text>
                <Badge>{media.length} items</Badge>
              </InlineStack>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  gap: "12px",
                }}
              >
                {media.map((item: any) => {
                  const isSelected = selectedMediaIds.has(item.id) || isGlobalMedia(item.id);
                  const isGlobal = isGlobalMedia(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleMediaToggle(item.id)}
                      style={{
                        position: "relative",
                        cursor: "pointer",
                        border: isSelected ? "3px solid #5C6AC4" : "3px solid transparent",
                        borderRadius: "8px",
                        overflow: "hidden",
                      }}
                    >
                      <Thumbnail size="small" source={item.url} alt={item.alt} />
                      {isGlobal && (
                        <div
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            background: "#5C6AC4",
                            color: "white",
                            borderRadius: "50%",
                            width: "20px",
                            height: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                          }}
                        >
                          G
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Text as="p" variant="bodySm" tone="subdued">
                Click images to assign to selected variant. "G" = global (shown for all variants).
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          {/* Variant Selector */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Select Variant
              </Text>

              {variantGroups.map((group: any) => (
                <BlockStack key={group.name} gap="200">
                  <Text as="h3" variant="headingSm" tone="subdued">
                    {group.name}
                  </Text>
                  <LegacyStack spacing="tight">
                    {group.variants.map((variant: any) => {
                      const isConfigured = variant.assignment?.isConfigured;
                      const isPartial = variant.assignment && !isConfigured;

                      return (
                        <Button
                          key={variant.id}
                          variant={
                            selectedVariantId === variant.id
                              ? "primary"
                              : isConfigured
                              ? "secondary"
                              : "tertiary"
                          }
                          onClick={() => handleVariantSelect(variant.id)}
                          size="slim"
                        >
                          <InlineStack gap="200" blockAlign="center">
                            {variant.displayName}
                            {isConfigured && <Icon source={CheckIcon} tone="success" />}
                            {isPartial && <Icon source={CircleIcon} tone="subdued" />}
                          </InlineStack>
                        </Button>
                      );
                    })}
                  </LegacyStack>
                </BlockStack>
              ))}
            </BlockStack>
          </Card>

          {/* Selected Variant Details */}
          {selectedVariant && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  {selectedVariant.displayName}
                </Text>

                {selectedVariant.image && (
                  <Thumbnail size="large" source={selectedVariant.image} />
                )}

                <LegacyStack>
                  <Badge tone={selectedVariant.available ? "success" : "warning"}>
                    {selectedVariant.available ? "In stock" : "Out of stock"}
                  </Badge>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    SKU: {selectedVariant.sku || "None"}
                  </Text>
                </LegacyStack>

                <div>
                  <Text as="p" variant="bodyMd">
                    {selectedMediaIds.size} images assigned
                  </Text>
                  {selectedMediaIds.size < 2 && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Assign at least 2 images for best results
                    </Text>
                  )}
                </div>

                <LegacyStack spacing="tight">
                  {selectedVariant.options.map((opt: any) => (
                    <Badge key={opt.name + opt.value}>
                      {opt.name}: {opt.value}
                    </Badge>
                  ))}
                </LegacyStack>
              </BlockStack>
            </Card>
          )}

          {/* Global Media Section */}
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Global Images
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                These images appear for all variants
              </Text>
              <Badge count={globalMedia?.length || 0} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
