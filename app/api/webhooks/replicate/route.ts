import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persistAsset } from "@/lib/generation/persist-asset";

/**
 * Replicate webhook handler.
 *
 * Updates the generation_asset row that was inserted with status='pending'
 * before createPrediction. The prediction_id is a first-class indexed column.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, status, output, error } = body as {
      id: string;
      status: "succeeded" | "failed" | "canceled" | string;
      output?: string | string[] | null;
      error?: string | null;
    };

    if (!id) {
      return NextResponse.json({ error: "Missing prediction id" }, { status: 400 });
    }

    // Match by prediction_id (indexed column), fallback to legacy metadata->>prediction_id
    const { data: asset } = await db
      .from("generation_assets")
      .select("id, generation_id, org_id, type, metadata")
      .or(`prediction_id.eq.${id},metadata->>prediction_id.eq.${id}`)
      .limit(1)
      .maybeSingle();

    if (!asset) {
      console.warn(`[webhook:replicate] no asset for prediction ${id}`);
      return NextResponse.json({ received: true });
    }

    if (status === "succeeded") {
      const outputUrl = Array.isArray(output) ? output[0] : output;
      if (outputUrl) {
        const kind: "image" | "video" | "audio" =
          asset.type === "video" ? "video" : asset.type === "audio" ? "audio" : "image";
        const persistentUrl = await persistAsset(outputUrl, {
          generationId: asset.generation_id,
          kind,
          basename: `webhook-${id.slice(0, 8)}`,
        });
        const prevMeta = (asset.metadata as Record<string, unknown>) || {};
        await db
          .from("generation_assets")
          .update({
            public_url: persistentUrl,
            storage_path: persistentUrl,
            status: "ready",
            metadata: { ...prevMeta, source_url: outputUrl },
          })
          .eq("id", asset.id);
      }
    } else if (status === "failed" || status === "canceled") {
      console.error(`[webhook:replicate] prediction ${id} ${status}: ${error}`);
      await db
        .from("generation_assets")
        .update({
          status: "failed",
          metadata: { error: error || status },
        })
        .eq("id", asset.id);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook:replicate] error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
