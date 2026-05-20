/**
 * Product Editor Page
 * Allows merchants to assign images to variants
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  LegacyStack,
  Thumbnail,
  Checkbox,
  Badge,
  Banner,
  Select,
  ButtonGroup,
} from "@shopify/polaris";
import {
  ArrowLeftIcon,
  MagicIcon,
  CheckIcon,
  AlertIcon
} from "@shopify/polaris-icons";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const productId = params.id;
  const response = await fetch(
    `${process.env.SHOPIFY_APP_URL}/app/api/product/${productId}`,
    {
      headers: {
        "Content-Type": "application/json",
        "Cookie": request.headers.get("Cookie") || "",
      },
    }
  );

  if (!response.ok) {
    throw new Response("Failed to load product", { status: response.status });
  }

  const data = await response.json();
  return json(data);
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const productId = params.id;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  const response = await fetch(
    `${process.env.SHOPIFY_APP_URL}/app/api/product/${productId}`,
    {
      method: actionType === "assign" ? "POST" : "PUT",
      headers: {
        "Content-Type": "application/json",
        "Cookie": request.headers.get("Cookie") || "",
      },
      body: JSON.stringify(Object.fromEntries(formData)),
    }
  );

  if (!response.ok) {
    return json({ error: "Action failed" }, { status: 400 });
  }

  return json({ success: true });
};

export default function ProductEditorPage() {
  const { product, config, summary } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants[0]?.id || null
  );
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(
    new Set(
      product.variants[0]?.assignment?.mediaIds?.map((m: any) => m.id) || []
    )
  );
  const [globalMediaIds, setGlobalMediaIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const selectedVariant = product.variants.find((v: any) => v.id === selectedVariantId);

  const handleVariantSelect = useCallback((variantId: string) => {
    const variant = product.variants.find((v: any) => v.id === variantId);
    setSelectedVariantId(variantId);
    setSelectedMediaIds(
      new Set(variant?.assignment?.mediaIds?.map((m: any) => m.id) || [])
    );
  }, [product.variants]);

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

  const handleToggleGlobal = useCallback((mediaId: string) => {
    setGlobalMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const formData = new FormData();
    formData.append("actionType", "assign");
    formData.append("variantGid", selectedVariant?.gid);
    formData.append("mediaIds", JSON.stringify(Array.from(selectedMediaIds)));

    try {
      await fetch(`/app/api/product/${product.id}`, {
        method: "POST",
        body: formData,
      });
    } finally {
      setSaving(false);
    }
  }, [product.id, selectedVariant, selectedMediaIds]);

  const handleAiAssign = useCallback(() => {
    fetcher.submit(
      { actionType: "ai-assign", productId: product.id },
      { method: "post", action: "/app/products/$id" }
    );
  }, [fetcher, product.id]);

  const getVariantStatus = (variant: any) => {
    if (!variant.assignment) return "empty";
    if (variant.assignment.imageCount >= 2) return "configured";
    if (variant.assignment.imageCount === 1) return "partial";
    return "empty";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "configured":
        return <Badge status="success">✓</Badge>;
      case "partial":
        return <Badge status="warning">⚠</Badge>;
      default:
        return <Badge status="critical">✗</Badge>;
    }
  };

  return (
    <Page
      title={product.title}
      subtitle={`${product.variants.length} variants · ${product.media.length} images`}
      breadcrumb={{
        content: "Products",
        onAction: () => navigate("/app/products"),
      }}
      primaryAction={{
        content: "Save Changes",
        onAction: handleSave,
        disabled: saving,
        loading: saving,
        icon: CheckIcon,
      }}
      secondaryActions={[
        {
          content: "AI Auto-Assign",
          icon: MagicIcon,
          onAction: handleAiAssign,
          disabled: fetcher.state === "submitting",
        },
      ]}
    >
      <Layout>
        {/* Status Banner */}
        <Layout.Section>
          {summary && (
            <Banner status={summary.percentage === 100 ? "success" : "info"}>
              <LegacyStack vertical>
                <Text variant="headingMd" as="p">
                  Configuration Progress
                </Text>
                <Text as="p">
                  {summary.configured} of {summary.total} variants fully configured
                  ({summary.percentage}%)
                </Text>
                {summary.partial > 0 && (
                  <Text as="p" tone="subdued">
                    {summary.partial} variants partially configured
                  </Text>
                )}
                {summary.empty > 0 && (
                  <Text as="p" tone="subdued">
                    {summary.empty} variants have no images assigned
                  </Text>
                )}
              </LegacyStack>
            </Banner>
          )}
        </Layout.Section>

        {/* Settings */}
        <Layout.Section oneThird>
          <Card>
            <LegacyStack vertical>
              <Text variant="headingMd" as="h3">
                Settings
              </Text>

              <Select
                label="Primary Option"
                options={product.options.map((opt: string) => ({
                  label: opt,
                  value: opt,
                }))}
                value={config?.primaryOption || product.options[0]}
                onChange={() => {}}
              />

              <Select
                label="Swatch Shape"
                options={[
                  { label: "Circle", value: "circle" },
                  { label: "Square", value: "square" },
                  { label: "Rounded", value: "rounded" },
                ]}
                value={config?.swatchShape || "circle"}
                onChange={() => {}}
              />

              <Button fullWidth>Save Settings</Button>
            </LegacyStack>
          </Card>
        </Layout.Section>

        {/* Variant List */}
        <Layout.Section oneThird>
          <Card title="Variants">
            <LegacyStack vertical>
              {product.variants.map((variant: any) => (
                <div
                  key={variant.id}
                  onClick={() => handleVariantSelect(variant.id)}
                  style={{
                    padding: "12px",
                    border: "1px solid #e1e3e5",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: selectedVariantId === variant.id ? "#f1f2f4" : "transparent",
                  }}
                >
                  <LegacyStack>
                    {getStatusBadge(getVariantStatus(variant))}
                    <Text variant="bodyMd" as="span">
                      {variant.title}
                    </Text>
                  </LegacyStack>
                </div>
              ))}
            </LegacyStack>
          </Card>
        </Layout.Section>

        {/* Media Selection */}
        <Layout.Section oneThird>
          <Card
            title={
              selectedVariant
                ? `Images for ${selectedVariant.title}`
                : "Select a variant"
            }
            actions={[
              {
                content: "Select All",
                onAction: () =>
                  setSelectedMediaIds(new Set(product.media.map((m: any) => m.id))),
              },
              {
                content: "Clear All",
                onAction: () => setSelectedMediaIds(new Set()),
              },
            ]}
          >
            <LegacyStack vertical>
              {product.media.map((media: any) => {
                const isSelected = selectedMediaIds.has(media.id);
                const isGlobal = globalMediaIds.has(media.id);

                return (
                  <div
                    key={media.id}
                    onClick={() => handleMediaToggle(media.id)}
                    style={{
                      position: "relative",
                      cursor: "pointer",
                      border: isSelected ? "2px solid #5C6AC4" : "2px solid transparent",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <Thumbnail
                      size="large"
                      source={media.src}
                      alt={media.alt}
                    />
                    <Checkbox
                      label=""
                      checked={isSelected}
                      onChange={() => handleMediaToggle(media.id)}
                      style={{ position: "absolute", top: 8, left: 8 }}
                    />
                    {isGlobal && (
                      <Badge
                        style={{ position: "absolute", top: 8, right: 8 }}
                      >
                        Global
                      </Badge>
                    )}
                    <Text
                      variant="bodySm"
                      as="p"
                      tone="subdued"
                      truncated
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        padding: "4px 8px",
                      }}
                    >
                      {media.alt}
                    </Text>
                  </div>
                );
              })}
            </LegacyStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
