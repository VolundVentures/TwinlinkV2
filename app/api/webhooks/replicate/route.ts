import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { id, status, output, error } = body;

    if (status === "succeeded" && output) {
      // Find the generation asset that references this prediction
      const { data: asset } = await db
        .from("generation_assets")
        .select("id, generation_id")
        .eq("metadata->>prediction_id", id)
        .single();

      if (asset) {
        const outputUrl = Array.isArray(output) ? output[0] : output;

        await db
          .from("generation_assets")
          .update({
            public_url: outputUrl,
            storage_path: outputUrl,
          })
          .eq("id", asset.id);
      }
    } else if (status === "failed") {
      console.error(`Replicate prediction ${id} failed:`, error);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
