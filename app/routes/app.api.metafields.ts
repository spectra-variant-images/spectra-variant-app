import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Define metafields for Spectra app
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { type, productId, variantId, data } = body;

  try {
    if (type === "ensure_metafields") {
      // Ensure metafield definitions exist for the app
      const definitions = [
        // Product-level metafield for variant media mappings
        {
          key: "variant_media",
          namespace: "spectra",
          ownerType: "PRODUCT",
          type: "single_line_text_field",
          name: "Variant Media Mappings",
        },
        // Product-level metafield for global media
        {
          key: "global_media",
          namespace: "spectra",
          ownerType: "PRODUCT",
          type: "list.single_line_text_field",
          name: "Global Media IDs",
        },
        // Product-level metafield for option configurations
        {
          key: "option_config",
          namespace: "spectra",
          ownerType: "PRODUCT",
          type: "json",
          name: "Option Configuration",
        },
        // Variant-level metafield for swatch data
        {
          key: "swatch",
          namespace: "spectra",
          ownerType: "PRODUCT_VARIANT",
          type: "json",
          name: "Swatch Data",
        },
      ];

      const results = [];
      for (const def of definitions) {
        try {
          const response = await admin.rest.post({
            path: `metafield_definitions`,
            data: {
              metafield_definition: {
                namespace: def.namespace,
                key: def.key,
                name: def.name,
                description: `Spectra app: ${def.name}`,
                owner_type: def.ownerType,
                type: def.type,
              },
            },
          });
          results.push({ success: true, key: def.key });
        } catch (error: any) {
          // Metafield might already exist - that's fine
          if (error.response?.body?.errors?.[0]?.includes("already exists")) {
            results.push({ success: true, key: def.key, exists: true });
          } else {
            results.push({ success: false, key: def.key, error: error.message });
          }
        }
      }

      return json({ success: true, results });
    }

    if (type === "update_swatch") {
      // Update variant swatch data
      const mutation = `
        mutation metafieldSet($metafields: [MetafieldSetInput!]!) {
          metafieldSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
              type
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
            value: JSON.stringify(data),
          },
        ],
      };

      const response = await admin.graphql(mutation, { variables });
      const result = await response.json();

      if (result.data?.metafieldSet?.userErrors?.length > 0) {
        return json(
          { error: result.data.metafieldSet.userErrors[0].message },
          { status: 400 }
        );
      }

      return json({ success: true, result: result.data.metafieldSet });
    }

    if (type === "get_swatches") {
      // Get all swatch data for a product
      const query = `
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  displayName
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
      `;

      const response = await admin.graphql(query, { variables: { id: productId } });
      const result = await response.json();

      const variants = result.data?.product?.variants?.edges?.map((edge: any) => {
        const variant = edge.node;
        const swatchMeta = variant.metafields?.edges?.find(
          (e: any) => e.node.key === "swatch"
        );
        return {
          id: variant.id,
          title: variant.title,
          displayName: variant.displayName,
          swatch: swatchMeta ? JSON.parse(swatchMeta.node.value) : null,
        };
      });

      return json({ success: true, variants });
    }

    return json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Metafields API error:", error);
    return json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
};
