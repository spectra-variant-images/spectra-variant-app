/**
 * AI Auto-Assign Feature
 * Use Claude API to automatically match product images to variants
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  LegacyStack,
  Badge,
  Banner,
  ProgressBar,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";
import {
  MagicIcon,
  CheckIcon,
  AlertIcon,
} from "@shopify/polaris-icons";
import * as models from "~/models/spectra.server";

// Claude API configuration
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  // Get recent AI jobs
  const jobs = await models.getShopAiJobs(shopId, 10);

  // Get store settings for quota
  const settings = await models.getStoreSettings(shopId);

  return json({
    jobs: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      total: job.total,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      results: job.results ? JSON.parse(job.results) : null,
      errors: job.errors ? JSON.parse(job.errors) : null,
    })),
    quota: {
      used: settings?.aiQuotaUsed || 0,
      allocated: settings?.aiQuotaAllocated || 100,
    },
    hasClaudeKey: !!CLAUDE_API_KEY,
  });
};

export const action = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  if (actionType === "start-job") {
    const productIds = formData.get("productIds") as string;
    const autoApply = formData.get("autoApply") === "true";

    const products = JSON.parse(productIds);
    const shopId = session.shop;

    // Create AI job
    const job = await models.createAiJob(shopId, products, {
      autoApply,
    });

    // Start processing in background
    processAiJob(admin, job.id, products, shopId).catch(console.error);

    return json({ success: true, jobId: job.id });
  }

  if (actionType === "apply-suggestions") {
    const jobId = formData.get("jobId") as string;
    const job = await models.getAiJob(jobId);

    if (!job || job.status !== "completed") {
      return json({ error: "Job not found or not completed" }, { status: 400 });
    }

    const results = JSON.parse(job.results || "[]");
    const shopId = session.shop;

    // Apply all suggestions
    for (const result of results) {
      if (!result.mappings) continue;

      const productGid = result.productGid;
      const idMatch = productGid.match(/Product\/(\d+)/);
      if (!idMatch) continue;

      const productId = BigInt(idMatch[1]);

      // Create product config if needed
      await models.upsertProductConfiguration(shopId, productId, productGid, {});

      // Apply each variant mapping
      for (const [variantGid, mediaIds] of Object.entries(result.mappings)) {
        const variantIdMatch = variantGid.match(/ProductVariant\/(\d+)/);
        if (!variantIdMatch) continue;

        await models.upsertVariantAssignment(
          shopId,
          variantGid,
          BigInt(variantIdMatch[1]),
          mediaIds as string[]
        );
      }
    }

    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

// Process AI job using Claude API
async function processAiJob(
  admin: any,
  jobId: string,
  productGids: string[],
  shopId: string
) {
  try {
    await models.updateAiJob(jobId, {
      status: "processing",
      startedAt: new Date(),
    });

    const results = [];

    for (const productGid of productGids) {
      // Fetch product data
      const response = await admin.graphql(
        `#graphql
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
            description
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  displayName
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
            media(first: 100) {
              edges {
                node {
                  mediaId
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
        `,
        { variables: { id: productGid } }
      );

      const productData = await response.json();
      const product = productData.data?.product;

      if (!product) continue;

      // Build prompt for Claude
      const prompt = buildAiPrompt(product);

      // Call Claude API
      const claudeResponse = await callClaude(prompt);

      // Parse and validate results
      const mappings = parseClaudeResponse(claudeResponse, product);

      results.push({
        productGid,
        productTitle: product.title,
        mappings: mappings.mappings || {},
        confidence: mappings.confidence || 0.8,
      });

      // Update progress
      await models.updateAiJob(jobId, {
        progress: results.length,
      });
    }

    // Mark job as complete
    await models.updateAiJob(jobId, {
      status: "completed",
      completedAt: new Date(),
      results: results,
    });

    // Update AI quota usage
    const totalImages = results.reduce((sum, r) => sum + (Object.keys(r.mappings || {}).length || 0), 0);
    await models.incrementAiUsage(shopId, totalImages);

  } catch (error: any) {
    console.error("AI job failed:", error);
    await models.updateAiJob(jobId, {
      status: "failed",
      failedAt: new Date(),
      errors: { message: error.message },
    });
  }
}

function buildAiPrompt(product: any): string {
  const variants = product.variants.edges.map((e: any) => ({
    id: e.node.id,
    title: e.node.title,
    options: e.node.selectedOptions,
  }));

  const media = product.media.edges.map((e: any, i: number) => ({
    id: e.node.mediaId,
    url: e.node.image?.url,
    alt: e.node.image?.altText,
  }));

  return `You are a product catalog manager. Analyze this product and assign images to variants.

Product: ${product.title}
${product.description ? `Description: ${product.description}` : ""}

VARIANTS:
${variants.map((v: any) => `${v.id} | ${v.title} | ${v.options.map((o: any) => `${o.name}: ${o.value}`).join(", ")}`).join("\n")}

IMAGES:
${media.map((m: any, i: number) => `${i + 1}. ${m.id} | ${m.alt || m.url.split("/").pop()}`).join("\n")}

TASK: For each variant, list the image IDs (1-${media.length}) that visually represent that variant.
Focus on: Color, pattern, material visible in each image.

Return ONLY this JSON format:
{
  "mappings": {
    "gid://shopify/ProductVariant/XXX": ["gid://shopify/MediaImage/111", "gid://shopify/MediaImage/222"]
  },
  "confidence": 0.85
}`;
}

async function callClaude(prompt: string): Promise<any> {
  if (!CLAUDE_API_KEY) {
    throw new Error("Claude API key not configured");
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Claude API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data;
}

function parseClaudeResponse(claudeResponse: any, product: any): any {
  const content = claudeResponse.content?.[0]?.text || "";

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON in Claude response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed;
}

export default function AiPage() {
  const { jobs, quota, hasClaudeKey } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [polling, setPolling] = useState(false);

  // Poll for job updates when there's a processing job
  useEffect(() => {
    const runningJob = jobs.find((j) => j.status === "processing");
    if (runningJob && !polling) {
      setPolling(true);
      const interval = setInterval(() => {
        fetcher.submit({}, { method: "get" });
      }, 3000);
      return () => {
        clearInterval(interval);
        setPolling(false);
      };
    }
  }, [jobs, polling, fetcher]);

  const runningJob = jobs.find((j) => j.status === "processing");
  const progressPercent = runningJob
    ? Math.round((runningJob.progress / runningJob.total) * 100)
    : 0;

  const handleApplySuggestions = (jobId: string) => {
    fetcher.submit(
      { actionType: "apply-suggestions", jobId },
      { method: "post" }
    );
  };

  return (
    <Page
      title="AI Auto-Assign"
      subtitle="Automatically match images to variants using AI"
      backAction={{ content: "Home", url: "/app" }}
    >
      <Layout>
        {/* API Key Warning */}
        {!hasClaudeKey && (
          <Layout.Section>
            <Banner status="warning">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  <strong>Claude API key not configured</strong>
                </Text>
                <Text as="p" variant="bodySm">
                  Add CLAUDE_API_KEY to your environment variables to enable AI features.
                </Text>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {/* Quota Banner */}
        <Layout.Section>
          <Banner
            status={quota.used >= quota.allocated ? "warning" : "info"}
          >
            <Text as="p" variant="bodyMd">
              <strong>AI Usage:</strong> {quota.used} / {quota.allocated} images this month
            </Text>
          </Banner>
        </Layout.Section>

        {/* Active Job Progress */}
        {runningJob && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Processing...
                  </Text>
                  <Badge>{progressPercent}%</Badge>
                </InlineStack>
                <ProgressBar progress={progressPercent} size="small" />
                <Text as="p" variant="bodyMd" tone="subdued">
                  {runningJob.progress} of {runningJob.total} products processed
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Quick Start */}
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Start AI Assignment
              </Text>
              <Text as="p" variant="bodyMd">
                Go to the Products page and click "AI Auto-Assign" on any product to
                automatically match images to variants.
              </Text>
              <Button onClick={() => navigate("/app/products")}>
                Go to Products
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Job History */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Recent Jobs
              </Text>

              {jobs.length === 0 ? (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No AI jobs run yet
                </Text>
              ) : (
                <LegacyStack spacing="loose" vertical>
                  {jobs.map((job) => {
                    const resultsCount = job.results
                      ? Object.keys(job.results).length
                      : 0;

                    return (
                      <div
                        key={job.id}
                        style={{
                          padding: "16px",
                          border: "1px solid #e1e3e5",
                          borderRadius: "8px",
                        }}
                      >
                        <BlockStack gap="200">
                          <InlineStack gap="200" blockAlign="center">
                            {job.status === "completed" && (
                              <Icon source={CheckIcon} tone="success" />
                            )}
                            {job.status === "failed" && (
                              <Icon source={AlertIcon} tone="critical" />
                            )}
                            {job.status === "processing" && (
                              <Icon source={MagicIcon} tone="info" />
                            )}

                            <Badge
                              status={
                                job.status === "completed"
                                  ? "success"
                                  : job.status === "failed"
                                  ? "critical"
                                  : "info"
                              }
                            >
                              {job.status}
                            </Badge>

                            <Text as="p" variant="bodyMd">
                              {job.progress} / {job.total} products
                            </Text>

                            {job.status === "completed" && (
                              <Button
                                size="slim"
                                onClick={() => handleApplySuggestions(job.id)}
                              >
                                Apply Suggestions
                              </Button>
                            )}
                          </InlineStack>

                          {job.completedAt && (
                            <Text as="p" variant="bodySm" tone="subdued">
                              {new Date(job.completedAt).toLocaleString()}
                            </Text>
                          )}

                          {job.errors && (
                            <Banner status="critical" size="small">
                              <Text as="p" variant="bodySm">
                                {job.errors.message}
                              </Text>
                            </Banner>
                          )}
                        </BlockStack>
                      </div>
                    );
                  })}
                </LegacyStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Icon({ source, tone }: { source: any; tone?: string }) {
  return (
    <span style={{ color: tone === "success" ? "#429861" : tone === "critical" ? "#d82c0d" : "#5C6AC4" }}>
      <source />
    </span>
  );
}
