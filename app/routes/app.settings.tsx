/**
 * Spectra Settings Page
 * Configure app-wide settings for swatches, filtering, and AI
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Select,
  TextField,
  Checkbox,
  Banner,
  Badge,
} from "@shopify/polaris";
import {
  SaveIcon,
} from "@shopify/polaris-icons";
import * as models from "~/models/spectra.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;

  const settings = await models.getStoreSettings(shopId);
  const stats = await models.getProductStats(shopId);

  return json({
    settings: {
      swatchStyle: settings?.swatchStyle || "round",
      swatchSize: settings?.swatchSize || 32,
      enableProductSwatches: settings?.enableProductSwatches ?? true,
      enableCollectionSwatches: settings?.enableCollectionSwatches ?? true,
      limitCollectionSwatches: settings?.limitCollectionSwatches || 5,
      hoverToChange: settings?.hoverToChange ?? true,
      lowStockThreshold: settings?.lowStockThreshold || 5,
      plan: settings?.plan || "free",
      maxProducts: settings?.maxProducts || 1,
      productCount: settings?.productCount || 0,
      aiQuotaUsed: settings?.aiQuotaUsed || 0,
      aiQuotaAllocated: settings?.aiQuotaAllocated || 100,
    },
    stats,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();

  const updates = {
    swatchStyle: formData.get("swatchStyle") as string || undefined,
    swatchSize: formData.get("swatchSize") ? parseInt(formData.get("swatchSize") as string) : undefined,
    enableProductSwatches: formData.get("enableProductSwatches") === "true",
    enableCollectionSwatches: formData.get("enableCollectionSwatches") === "true",
    limitCollectionSwatches: formData.get("limitCollectionSwatches") ? parseInt(formData.get("limitCollectionSwatches") as string) : undefined,
    hoverToChange: formData.get("hoverToChange") === "true",
    lowStockThreshold: formData.get("lowStockThreshold") ? parseInt(formData.get("lowStockThreshold") as string) : undefined,
  };

  await models.upsertStoreSettings(shopId, updates);

  return json({ success: true });
};

export default function SettingsPage() {
  const { settings, stats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [saving, setSaving] = useState(false);

  const handleSave = (formData: FormData) => {
    setSaving(true);
    fetcher.submit(formData, { method: "post" });
    setTimeout(() => setSaving(false), 500);
  };

  const swatchStyleOptions = [
    { label: "Round", value: "round" },
    { label: "Square", value: "square" },
    { label: "Pill", value: "pill" },
  ];

  return (
    <Page
      title="Settings"
      subtitle="Configure Spectra app behavior"
      primaryAction={{
        content: "Save Changes",
        icon: SaveIcon,
        onAction: () => {
          const form = document.getElementById("settings-form") as HTMLFormElement;
          if (form) form.requestSubmit();
        },
        disabled: saving,
        loading: saving,
      }}
    >
      <Layout>
        {/* Usage Banner */}
        <Layout.Section>
          <Banner status="info">
            <BlockStack gap="200">
              <InlineStack gap="200">
                <Text as="p" variant="bodyMd">
                  <strong>Plan:</strong> {settings.plan.charAt(0).toUpperCase() + settings.plan.slice(1)}
                </Text>
                <Badge>{settings.productCount} / {settings.maxProducts} products</Badge>
                <Text as="p" variant="bodyMd">
                  <strong>AI:</strong> {settings.aiQuotaUsed} / {settings.aiQuotaAllocated} images this month
                </Text>
              </InlineStack>
            </BlockStack>
          </Banner>
        </Layout.Section>

        {/* Swatch Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Swatch Appearance
              </Text>

              <FormSelect
                label="Swatch Style"
                options={swatchStyleOptions}
                value={settings.swatchStyle}
                name="swatchStyle"
              />

              <FormNumberInput
                label="Swatch Size (pixels)"
                value={settings.swatchSize}
                name="swatchSize"
                min={20}
                max={60}
                helpText="Size of each swatch button"
              />

              <Checkbox
                label="Enable on product pages"
                checked={settings.enableProductSwatches}
                name="enableProductSwatches"
                helpText="Show swatches on product detail pages"
              />

              <Checkbox
                label="Enable on collection pages"
                checked={settings.enableCollectionSwatches}
                name="enableCollectionSwatches"
                helpText="Show swatches on collection and search result pages"
              />

              {settings.enableCollectionSwatches && (
                <FormNumberInput
                  label="Max Swatches on Collection"
                  value={settings.limitCollectionSwatches}
                  name="limitCollectionSwatches"
                  min={3}
                  max={10}
                  helpText="Maximum number of swatches to show per product on collection pages"
                />
              )}

              <Checkbox
                label="Hover to change image"
                checked={settings.hoverToChange}
                name="hoverToChange"
                helpText="Update product image when hovering over swatches on collection pages"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Inventory Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Inventory Settings
              </Text>

              <FormNumberInput
                label="Low Stock Threshold"
                value={settings.lowStockThreshold}
                name="lowStockThreshold"
                min={0}
                max={100}
                helpText="Show 'Only X left' badge when stock is at or below this number"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Hidden form for submission */}
        <form id="settings-form" style={{ display: "none" }} method="post"></form>
      </Layout>
    </Page>
  );
}

function FormSelect({
  label,
  options,
  value,
  name,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  name: string;
}) {
  return (
    <BlockStack gap="100">
      <Text as="label" variant="bodyMd" fontWeight="medium">
        {label}
      </Text>
      <select
        name={name}
        defaultValue={value}
        style={{
          padding: "8px 12px",
          border: "1px solid #e1e3e5",
          borderRadius: "4px",
          fontSize: "14px",
          minWidth: "200px",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </BlockStack>
  );
}

function FormNumberInput({
  label,
  value,
  name,
  min,
  max,
  helpText,
}: {
  label: string;
  value: number;
  name: string;
  min: number;
  max: number;
  helpText?: string;
}) {
  return (
    <BlockStack gap="100">
      <Text as="label" variant="bodyMd" fontWeight="medium">
        {label}
      </Text>
      <input
        type="number"
        name={name}
        defaultValue={value}
        min={min}
        max={max}
        style={{
          padding: "8px 12px",
          border: "1px solid #e1e3e5",
          borderRadius: "4px",
          fontSize: "14px",
          width: "100px",
        }}
      />
      {helpText && (
        <Text as="p" variant="bodySm" tone="subdued">
          {helpText}
        </Text>
      )}
    </BlockStack>
  );
}

function Checkbox({
  label,
  checked,
  name,
  helpText,
}: {
  label: string;
  checked: boolean;
  name: string;
  helpText?: string;
}) {
  return (
    <BlockStack gap="100">
      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          name={name}
          defaultChecked={checked}
          value="true"
          style={{ width: "16px", height: "16px" }}
        />
        <Text as="span" variant="bodyMd">
          {label}
        </Text>
      </label>
      {helpText && (
        <Text as="p" variant="bodySm" tone="subdued" style={{ marginLeft: "24px" }}>
          {helpText}
        </Text>
      )}
    </BlockStack>
  );
}
