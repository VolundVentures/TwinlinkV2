const REPLICATE_API_URL = "https://api.replicate.com/v1";

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string[] | string | null;
  error: string | null;
  urls: {
    get: string;
    cancel: string;
  };
};

export async function createPrediction(
  model: string,
  input: Record<string, unknown>,
  webhookUrl?: string
): Promise<ReplicatePrediction> {
  // Use the official models endpoint: /v1/models/{owner}/{name}/predictions
  const response = await fetch(
    `${REPLICATE_API_URL}/models/${model}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input,
        ...(webhookUrl && {
          webhook: webhookUrl,
          webhook_events_filter: ["completed"],
        }),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function getPrediction(id: string): Promise<ReplicatePrediction> {
  const response = await fetch(`${REPLICATE_API_URL}/predictions/${id}`, {
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Replicate API error: ${response.status}`);
  }

  return response.json();
}

export async function waitForPrediction(
  id: string,
  maxWaitMs = 300000,
  pollIntervalMs = 2000
): Promise<ReplicatePrediction> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const prediction = await getPrediction(id);

    if (prediction.status === "succeeded") return prediction;
    if (prediction.status === "failed") {
      throw new Error(`Prediction failed: ${prediction.error}`);
    }
    if (prediction.status === "canceled") {
      throw new Error("Prediction was canceled");
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error("Prediction timed out");
}

// Model shortcuts
export const MODELS = {
  // Image generation
  FLUX_PRO: "black-forest-labs/flux-1.1-pro",
  FLUX_SCHNELL: "black-forest-labs/flux-schnell",

  // Video generation
  KLING: "klingai/kling-v2.0-pro",

  // Lip sync
  SYNC_LABS: "sync-labs/video-lipsync",
} as const;

export async function generateImage(
  prompt: string,
  options: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    model?: string;
  } = {}
): Promise<string> {
  const {
    width = 1024,
    height = 1024,
    model = MODELS.FLUX_PRO,
  } = options;

  const prediction = await createPrediction(model, {
    prompt,
    width,
    height,
    num_outputs: 1,
  });

  const result = await waitForPrediction(prediction.id);

  if (Array.isArray(result.output)) return result.output[0];
  return result.output!;
}
