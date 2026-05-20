/**
 * AI Auto-Assign Page
 * Allows merchants to run AI-powered variant image assignment
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  LegacyStack,
  ProgressBar,
  Banner,
  Select,
  Checkbox,
  TextField,
} from "@shopify/polaris";
import {
  ArrowLeftIcon,
  MagicIcon,
} from "@shopify/polaris-icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get recent AI jobs
  // const jobs = await listAiJobs(session.shop, { take: 10 });

  return json({
    shop: session.shop,
    jobs: [], // Replace with actual jobs
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "start-ai") {
    const productIds = formData.get("productIds")?.toString().split(",") || [];
    const language = formData.get("language")?.toString() || "en";
    const confidenceThreshold = parseInt(
      formData.get("confidenceThreshold")?.toString() || "80"
    );

    // Create AI job
    // const job = await createAiJob(session.shop, productIds, {
    //   language,
    //   confidenceThreshold,
    // });

    return json({
      success: true,
      jobId: "mock-job-id",
      // jobId: job.id,
    });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function AiAssignPage() {
  const { jobs } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [language, setLanguage] = useState("auto");
  const [confidenceThreshold, setConfidenceThreshold] = useState(80);
  const [reviewMode, setReviewMode] = useState(true);

  const handleStartAi = () => {
    if (selectedProducts.length === 0) return;

    fetcher.submit(
      {
        actionType: "start-ai",
        productIds: selectedProducts.join(","),
        language,
        confidenceThreshold,
        reviewMode,
      },
      { method: "post" }
    );
  };

  const languages = [
    { label: "Auto-detect", value: "auto" },
    { label: "English", value: "en" },
    { label: "Spanish", value: "es" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Portuguese", value: "pt" },
  ];

  return (
    <Page
      title="AI Auto-Assign"
      subtitle="Automatically match images to variants using AI"
      breadcrumb={{
        content: "Dashboard",
        onAction: () => navigate("/app"),
      }}
      primaryAction={{
        content: "Start AI Assignment",
        icon: MagicIcon,
        onAction: handleStartAi,
        disabled: selectedProducts.length === 0,
        loading: fetcher.state === "submitting",
      }}
    >
      <Layout>
        {/* Info Banner */}
        <Layout.Section>
          <Banner status="info">
            <LegacyStack vertical>
              <Text variant="headingMd" as="p">
                How AI Auto-Assign Works
              </Text>
              <Text as="p">
                Our AI analyzes your product titles, variant names, image
                filenames, and alt text to intelligently match images to the
                correct variants. It supports multiple languages and learns from
                your corrections over time.
              </Text>
            </LegacyStack>
          </Banner>
        </Layout.Section>

        {/* Configuration */}
        <Layout.Section oneThird>
          <Card title="AI Configuration">
            <LegacyStack vertical>
              <Select
                label="Detection Language"
                options={languages}
                value={language}
                onChange={setLanguage}
                helpText="Auto-detect works for most stores"
              />

              <TextField
                label="Confidence Threshold"
                type="number"
                value={confidenceThreshold.toString()}
                onChange={setConfidenceThreshold}
                helpText="Only auto-apply matches above this %"
                suffix="%"
              />

              <Checkbox
                label="Review mode"
                checked={reviewMode}
                onChange={setReviewMode}
                helpText="Show suggestions before applying"
              />
            </LegacyStack>
          </Card>
        </Layout.Section>

        {/* Product Selection */}
        <Layout.Section twoThirds>
          <Card
            title="Select Products"
            actions={[
              {
                content: "Select All Unconfigured",
                onAction: () => {},
              },
            ]}
          >
            <LegacyStack vertical>
              <Text as="p" tone="subdued">
                Select products to process. Products with fewer than 50 images
                work best.
              </Text>

              {/* Product list would go here */}
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  border: "2px dashed #e1e3e5",
                  borderRadius: "8px",
                }}
              >
                <Text as="p" tone="subdued">
                  Product selection coming soon. For now, visit the{" "}
                  <a
                    href="/app/products"
                    style={{ color: "#5C6AC4" }}
                  >
                    Products page
                  </a>{" "}
                  to run AI on individual products.
                </Text>
              </div>
            </LegacyStack>
          </Card>
        </Layout.Section>

        {/* Recent Jobs */}
        <Layout.Section>
          <Card title="Recent AI Jobs">
            {jobs.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <Text as="p" tone="subdued">
                  No AI jobs run yet
                </Text>
              </div>
            ) : (
              <LegacyStack vertical>
                {jobs.map((job: any) => (
                  <div
                    key={job.id}
                    style={{
                      padding: "12px",
                      border: "1px solid #e1e3e5",
                      borderRadius: "8px",
                    }}
                  >
                    <LegacyStack alignment="center">
                      <Text variant="bodyMd" as="span">
                        {job.productIds.length} products
                      </Text>
                      <Badge status={job.status === "completed" ? "success" : "info"}>
                        {job.status}
                      </Badge>
                      <ProgressBar progress={job.progress} size="small" />
                    </LegacyStack>
                  </div>
                ))}
              </LegacyStack>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
