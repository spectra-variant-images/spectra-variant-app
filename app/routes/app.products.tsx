/**
 * Products List Page
 * Shows all products with their configuration status
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Card,
  Layout,
  Text,
  Button,
  DataTable,
  LegacyCard,
  Badge,
  TextField,
  Pagination,
  Frame,
  Icon,
} from "@shopify/polaris";
import { SearchIcon, PlusIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 50;
  const search = url.searchParams.get("search") || "";

  try {
    // Fetch products from Shopify
    const response = await admin.rest.get({
      path: "products",
      query: {
        limit,
        page_info: url.searchParams.get("page_info") || undefined,
      },
    });
    const shopifyProducts = await response.json();

    const products = shopifyProducts.body?.products?.map((p: any) => ({
      id: p.id,
      gid: `gid://shopify/Product/${p.id}`,
      title: p.title,
      handle: p.handle,
      status: p.status,
      variantsCount: p.variants?.length || 0,
      imagesCount: p.images?.length || 0,
      featuredImage: p.image?.src,
      updatedAt: p.updated_at,
    })) || [];

    return json({
      products,
      page,
      hasNext: shopifyProducts.body?.page_info?.hasNextPage,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return json({ products: [], page: 1, hasNext: false });
  }
};

export default function ProductsPage() {
  const { products, page, hasNext } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rows = products.map((product) => [
    <Link to={`/app/products/${product.id}`} key={product.id}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {product.featuredImage && (
          <img
            src={product.featuredImage}
            alt=""
            style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
          />
        )}
        <Text variant="bodyMd" fontWeight="medium" as="span">
          {product.title}
        </Text>
      </div>
    </Link>,
    <Text variant="bodyMd" as="span">
      {product.variantsCount} variants
    </Text>,
    <Badge>{product.imagesCount} images</Badge>,
    <Button
      variant="plain"
      onClick={() => navigate(`/app/products/${product.id}`)}
    >
      Configure
    </Button>,
  ]);

  return (
    <Frame>
      <Page
        title="Products"
        primaryAction={{
          content: "AI Auto-Assign",
          icon: PlusIcon,
          onAction: () => navigate("/app/ai"),
        }}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: "16px", borderBottom: "1px solid #e1e3e5" }}>
                <TextField
                  placeholder="Search products..."
                  prefix={<Icon source={SearchIcon} />}
                  onChange={(value) => {
                    const params = new URLSearchParams({ search: value });
                    navigate(`/app/products?${params.toString()}`);
                  }}
                />
              </div>
              <DataTable
                columnContentTypes={[
                  "text",
                  "numeric",
                  "numeric",
                  "text",
                ]}
                headings={[
                  "Product",
                  "Variants",
                  "Images",
                  "Actions",
                ]}
                rows={rows}
              />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
