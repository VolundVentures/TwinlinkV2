/**
 * Remotion rendering module.
 *
 * In production, uses @remotion/lambda for distributed AWS Lambda rendering.
 * In development, falls back to @remotion/renderer for local rendering.
 *
 * Setup required:
 * 1. Deploy Lambda function: npx remotion lambda functions deploy
 * 2. Deploy site to S3: npx remotion lambda sites create remotion/index.ts
 * 3. Set env vars: REMOTION_AWS_ACCESS_KEY_ID, REMOTION_AWS_SECRET_ACCESS_KEY,
 *    REMOTION_FUNCTION_NAME, REMOTION_SERVE_URL, REMOTION_REGION
 */

import { trackCost } from "./cost-tracker";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 200; // ~10 minutes max wait

type RenderOptions = {
  compositionId: string;
  inputProps: Record<string, unknown>;
  format?: "mp4" | "webm";
  generationId?: string;
};

type RenderResult = {
  url: string;
  sizeBytes?: number;
  durationMs?: number;
};

/**
 * Render a Remotion composition and return the output URL.
 * Uses Lambda in production, local renderer in dev.
 */
export async function renderComposition(
  options: RenderOptions
): Promise<RenderResult> {
  const {
    compositionId,
    inputProps,
    format = "mp4",
    generationId,
  } = options;

  console.log(
    "[remotion] Rendering composition:",
    compositionId,
    "format:", format
  );

  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;
  const region = process.env.REMOTION_REGION || "us-east-1";

  if (!functionName || !serveUrl) {
    throw new Error(
      "Remotion Lambda not configured. Set REMOTION_FUNCTION_NAME and REMOTION_SERVE_URL in .env. " +
      "Run: npx remotion lambda functions deploy && npx remotion lambda sites create remotion/index.tsx --site-name=twinlink-remotion"
    );
  }

  try {
    // Dynamic import to avoid bundling Lambda SDK in client
    const { renderMediaOnLambda, getRenderProgress } = await import(
      "@remotion/lambda/client"
    );

    const startTime = Date.now();

    // Trigger the render
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: region as Parameters<typeof renderMediaOnLambda>[0]["region"],
      functionName,
      serveUrl,
      composition: compositionId,
      codec: format === "webm" ? "vp8" : "h264",
      inputProps,
    });

    console.log("[remotion] Render started:", renderId, "bucket:", bucketName);

    // Poll for completion
    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
      const progress = await getRenderProgress({
        renderId,
        bucketName,
        functionName,
        region: region as Parameters<typeof getRenderProgress>[0]["region"],
      });

      if (progress.done && progress.outputFile) {
        const durationMs = Date.now() - startTime;
        console.log(
          "[remotion] Render complete in",
          durationMs,
          "ms. Output:",
          progress.outputFile
        );

        if (generationId) {
          trackCost(
            generationId,
            "remotion-lambda",
            1,
            `Remotion render ${compositionId} (${durationMs}ms)`
          );
        }

        return {
          url: progress.outputFile,
          sizeBytes: progress.outputSizeInBytes ?? undefined,
          durationMs,
        };
      }

      if (progress.fatalErrorEncountered) {
        const errorMessages = progress.errors
          ?.map((e) => e.message || e.stack || String(e))
          .join("; ") || "Unknown error";
        console.error("[remotion] Fatal render error:", errorMessages);
        throw new Error(`Remotion render failed (renderId: ${renderId}): ${errorMessages}`);
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error("Remotion render timed out after " + MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000 + "s");
  } catch (error) {
    console.error("[remotion] Render error:", error);
    throw error;
  }
}
