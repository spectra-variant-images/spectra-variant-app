/**
 * Spectra App Dashboard
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  LegacyStack,
  Badge,
  BlockStack,
  Box,
} from "@shopify/polaris";
import {
  ImageIcon,
  DesktopIcon,
  MagicIcon,
  ProductIcon,
} from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get store settings
  // const settings = await getStoreSettings(session.shop);

  return json({
    shop: session.shop,
    stats: {
      productsConfigured: 0,
      totalProducts: 0,
      aiQuotaUsed: 0,
      aiQuotaTotal: 100,
    },
  });
};

export default function Index() {
  const { shop, stats } = useLoaderData<typeof loader>();

  const features = [
    {
      title: "Product Gallery Filtering",
      description:
        "Show only images for the selected variant. No more confusion.",
      icon: ImageIcon,
      status: "core",
      link: "/app/products",
    },
    {
      title: "Variant Swatches",
      description:
        "Beautiful color and image swatches replace dropdowns.",
      icon: ProductIcon,
      status: "core",
      link: "/app/products",
    },
    {
      title: "Collection Page Swatches",
      description:
        "Show variant swatches on collection pages. Hover to preview.",
      icon: DesktopIcon,
      status: "premium",
      link: "#",
    },
    {
      title: "AI Auto-Assign",
      description:
        "Let AI match your images to variants. Multi-language support.",
      icon: MagicIcon,
      status: "ai",
      link: "/app/ai",
    },
  ];

  return (
    <Page
      title="Spectra Variant Images & Swatches"
      subtitle={`Configure variant images for ${shop}`}
    >
      <Layout>
        {/* Stats */}
        <Layout.Section>
          <Layout>
            {[
              {
                label: "Products Configured",
                value: `${stats.productsConfigured}/${stats.totalProducts}`,
              },
              {
                label: "AI Quota Used",
                value: `${stats.aiQuotaUsed}/${stats.aiQuotaTotal}`,
              },
              {
                label: "Status",
                value: "Active",
              },
            ].map((stat, i) => (
              <Layout.Section key={i} oneThird>
                <Card>
                  <BlockStack gap="2">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {stat.label}
                    </Text>
                    <Text as="h2" variant="heading2xl">
                      {stat.value}
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            ))}
          </Layout>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text as="h2" variant="headingMd">
                Quick Actions
              </Text>
              <LegacyStack distribution="equalSpacing">
                <Button url="/app/products" primary>
                  Configure Products
                </Button>
                <Button url="/app/ai" icon={MagicIcon}>
                  AI Auto-Assign
                </Button>
                <Button url="/app/settings">
                  Settings
                </Button>
              </LegacyStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Features */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text as="h2" variant="headingMd">
                Features
              </Text>

              {features.map((feature) => (
                <Box
                  key={feature.title}
                  padding="4"
                  borderWidth="1"
                  borderRadius="2"
                >
                  <LegacyStack alignment="center" spacing="loose">
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "8px",
                        background: "#f1f2f4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <feature.icon />
                    </div>

                    <LegacyStack.Item fill>
                      <BlockStack gap="1">
                        <LegacyStack alignment="center" spacing="tight">
                          <Text as="h3" variant="headingMd">
                            {feature.title}
                          </Text>
                          {feature.status === "premium" && (
                            <Badge status="info">Pro</Badge>
                          )}
                          {feature.status === "ai" && (
                            <Badge status="success">AI</Badge>
                          )}
                        </LegacyStack>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          {feature.description}
                        </Text>
                      </BlockStack>
                    </LegacyStack.Item>

                    <Button url={feature.link} disabled={feature.link === "#"}>
                      Configure
                    </Button>
                  </LegacyStack>
                </Box>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Getting Started */}
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="4">
              <Text as="h2" variant="headingMd">
                Getting Started
              </Text>

              <LegacyStack vertical spacing="tight">
                <LegacyStack spacing="tight">
                  <Badge status="success">1</Badge>
                  <Text>Enable the App Embed in your theme editor</Text>
                </LegacyStack>

                <LegacyStack spacing="tight">
                  <Badge status="success">2</Badge>
                  <Text>Navigate to Products and select a product</Text>
                </LegacyStack>

                <LegacyStack spacing="tight">
                  <Badge status="success">3</Badge>
                  <Text>Assign images to each variant</Text>
                </LegacyStack>

                <LegacyStack spacing="tight">
                  <Badge status="info">4</Badge>
                  <Text>
                    Use AI Auto-Assign to speed up bulk configuration
                  </Text>
                </LegacyStack>
              </LegacyStack>

              <Button url="/app/products" primary>
                Start Configuring
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
