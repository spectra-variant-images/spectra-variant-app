/**
 * Spectra Swatches Configuration
 * Admin UI for setting up color swatches for product variants
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigate, useSearchParams } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  TextField,
  ColorPicker,
  BlockStack,
  InlineStack,
  Badge,
  Thumbnail,
  DataTable,
} from "@shopify/polaris";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  if (!productId) {
    // Get first product if none specified
    const response = await admin.graphql(
      `#graphql
      query {
        products(first: 1) {
          edges {
            node {
              id
              title
            }
          }
        }
      }
      `
    );
    const data = await response.json();
    const firstProduct = data.data?.products?.edges?.[0]?.node;
    if (firstProduct) {
      return json({ productId: firstProduct.id, productTitle: firstProduct.title, variants: [] });
    }
    return json({ productId: null, productTitle: null, variants: [] });
  }

  // Fetch product with variants and swatch data
  const response = await admin.graphql(
    `#graphql
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
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
              availableForSale
              selectedOptions {
                name
                value
              }
              image {
                url
                altText
              }
              metafields(namespace: "spectra", first: 10) {
                edges {
                  node {
                    id
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        }
      }
    }
    `,
    { variables: { id: productId } }
  );

  const result = await response.json();
  const product = result.data?.product;

  const variants = product?.variants?.edges?.map((edge: any) => {
    const variant = edge.node;
    const swatchMeta = variant.metafields?.edges?.find((e: any) => e.node.key === "swatch");
    return {
      id: variant.id,
      gid: variant.id,
      title: variant.title,
      displayName: variant.displayName,
      available: variant.availableForSale,
      options: variant.selectedOptions,
      image: variant.image?.url,
      swatch: swatchMeta ? JSON.parse(swatchMeta.node.value) : null,
    };
  });

  return json({
    productId: product.id,
    productTitle: product.title,
    options: product.options,
    variants,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "updateSwatch") {
    const variantId = formData.get("variantId") as string;
    const color = formData.get("color") as string;
    const useImage = formData.get("useImage") === "true";
    const image = formData.get("image") as string;

    const swatchData: any = {};
    if (useImage && image) {
      swatchData.image = image;
    } else if (color && color !== "#000000") {
      swatchData.color = color;
    }

    const mutation = `
      mutation metafieldSet($metafields: [MetafieldSetInput!]!) {
        metafieldSet(metafields: $metafields) {
          metafields {
            id
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      metafields: [
        {
          ownerId: variantId,
          namespace: "spectra",
          key: "swatch",
          type: "json",
          value: JSON.stringify(swatchData),
        },
      ],
    };

    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();

    if (result.data?.metafieldSet?.userErrors?.length > 0) {
      return json({ error: result.data.metafieldSet.userErrors[0].message }, { status: 400 });
    }

    return json({ success: true });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function SwatchesPage() {
  const { productId, productTitle, options, variants } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Group variants by option values (for color organization)
  const colorOption = options?.find((o: any) => o.name.toLowerCase().includes("color") || o.name.toLowerCase().includes("colour"));
  const groupedVariants = colorOption
    ? colorOption.values.map((value: string) =>
        variants.filter((v: any) => v.options.some((o: any) => o.value === value))
      )
    : variants.map((v: any) => [v]);

  return (
    <Page
      title="Color Swatches"
      subtitle={productTitle}
      backAction={{ content: "Products", url: "/app/products" }}
      primaryAction={{
        content: "View on Storefront",
        url: `/app/products/${productId?.split("/").pop()}`,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Text as="p" variant="bodyMd">
                Configure color swatches for each variant. Swatches will appear on product pages
                and collection pages.
              </Text>

              {groupedVariants.map((group: any[], groupIndex: number) => (
                <Card key={groupIndex}>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">
                      {group[0]?.options?.find((o: any) =>
                        colorOption?.name?.toLowerCase().includes("color")
                      )?.value || `Group ${groupIndex + 1}`}
                    </Text>

                    <InlineStack gap="400">
                      {group.map((variant: any) => (
                        <SwatchConfigCard
                          key={variant.id}
                          variant={variant}
                          onSubmit={(data) => {
                            // Submit via form
                            const form = document.getElementById(`swatch-form-${variant.gid.split("/").pop()}`) as HTMLFormElement;
                            if (form) {
                              form.requestSubmit();
                            }
                          }}
                        />
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function SwatchConfigCard({ variant, onSubmit }: { variant: any; onSubmit: (data: any) => void }) {
  const [color, setColor] = useState(variant.swatch?.color || "#000000");
  const [useImage, setUseImage] = useState(!!variant.swatch?.image);

  return (
    <Card>
      <BlockStack gap="300">
        {variant.image && (
          <Thumbnail size="small" source={variant.image} alt={variant.displayName} />
        )}
        <Text as="p" variant="bodySm" fontWeight="medium">
          {variant.displayName}
        </Text>

        <Form
          id={`swatch-form-${variant.gid.split("/").pop()}`}
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ variantId: variant.id, color, useImage, image: variant.image });
          }}
        >
          <input type="hidden" name="intent" value="updateSwatch" />
          <input type="hidden" name="variantId" value={variant.id} />
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="useImage" value={useImage.toString()} />
          <input type="hidden" name="image" value={variant.image || ""} />
        </Form>

        <BlockStack gap="200">
          <InlineStack gap="200">
            <button
              type="button"
              onClick={() => setUseImage(false)}
              style={{
                padding: "8px 16px",
                border: "1px solid #e1e3e5",
                borderRadius: "4px",
                background: !useImage ? "#000" : "#fff",
                color: !useImage ? "#fff" : "#000",
                cursor: "pointer",
              }}
            >
              Color
            </button>
            <button
              type="button"
              onClick={() => setUseImage(true)}
              style={{
                padding: "8px 16px",
                border: "1px solid #e1e3e5",
                borderRadius: "4px",
                background: useImage ? "#000" : "#fff",
                color: useImage ? "#fff" : "#000",
                cursor: "pointer",
              }}
            >
              Use Image
            </button>
          </InlineStack>

          {!useImage ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: "40px", height: "40px", cursor: "pointer" }}
              />
              <Text as="span" variant="bodySm">
                {color}
              </Text>
            </div>
          ) : (
            variant.image && (
              <Thumbnail size="small" source={variant.image} alt="Swatch preview" />
            )
          )}

          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: useImage ? undefined : color,
              backgroundImage: useImage ? `url(${variant.image})` : undefined,
              backgroundSize: "cover",
              border: "1px solid #e1e3e5",
            }}
          />

          <Button
            size="slim"
            onClick={() => {
              const form = document.getElementById(`swatch-form-${variant.gid.split("/").pop()}`) as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
          >
            Save
          </Button>
        </BlockStack>

        {variant.available ? (
          <Badge tone="success">In stock</Badge>
        ) : (
          <Badge tone="warning">Out of stock</Badge>
        )}
      </BlockStack>
    </Card>
  );
}
