import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPrediction } from "@/lib/generation/replicate";
import { persistAsset } from "@/lib/generation/persist-asset";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { generationId } = await params;

    const { data: generation, error } = await db
      .from("generations")
      .select("*, generation_assets(*)")
      .eq("id", generationId)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !generation) {
      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 }
      );
    }

    // Orphan recovery: if the user clicked Stop mid-flight, some Replicate
    // predictions may have completed successfully but we never claimed them
    // (agent loop bailed before polling returned). Sweep those here before
    // handing the generation back to the client.
    const orphans = (generation.generation_assets || []).filter(
      (a: { status: string | null; prediction_id: string | null }) =>
        a.status === "pending" && a.prediction_id
    );
    if (orphans.length > 0) {
      console.log(
        `[api/generations] ${orphans.length} orphaned prediction(s) to recover for ${generationId}`
      );
      const recoveries = await Promise.allSettled(
        orphans.map(async (asset: {
          id: string;
          type: string;
          prediction_id: string;
          metadata: Record<string, unknown> | null;
        }) => {
          try {
            const pred = await getPrediction(asset.prediction_id);
            if (pred.status === "succeeded") {
              const outputUrl = Array.isArray(pred.output)
                ? (pred.output as string[])[0]
                : (pred.output as string);
              if (outputUrl) {
                const kind: "image" | "video" | "audio" =
                  asset.type === "video" ? "video" : asset.type === "audio" ? "audio" : "image";
                const persistentUrl = await persistAsset(outputUrl, {
                  generationId,
                  kind,
                  basename: `orphan-${asset.prediction_id.slice(0, 8)}`,
                });
                await db
                  .from("generation_assets")
                  .update({
                    public_url: persistentUrl,
                    storage_path: persistentUrl,
                    status: "ready",
                    metadata: { ...(asset.metadata || {}), source_url: outputUrl, recovered: true },
                  })
                  .eq("id", asset.id);
                return { id: asset.id, status: "recovered" };
              }
            } else if (pred.status === "failed" || pred.status === "canceled") {
              await db
                .from("generation_assets")
                .update({
                  status: "failed",
                  metadata: { ...(asset.metadata || {}), error: pred.error || pred.status },
                })
                .eq("id", asset.id);
              return { id: asset.id, status: "failed" };
            }
            return { id: asset.id, status: "still-running" };
          } catch (err) {
            console.warn(
              `[api/generations] orphan recovery failed for ${asset.id}:`,
              err instanceof Error ? err.message : err
            );
            return { id: asset.id, status: "error" };
          }
        })
      );
      const recoveredCount = recoveries.filter(
        (r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<{ status: string }>).value.status === "recovered"
      ).length;
      if (recoveredCount > 0) {
        console.log(
          `[api/generations] recovered ${recoveredCount} orphan prediction(s); re-fetching generation`
        );
        // Re-fetch with the updated asset rows
        const { data: refetched } = await db
          .from("generations")
          .select("*, generation_assets(*)")
          .eq("id", generationId)
          .eq("org_id", auth.orgId)
          .single();
        if (refetched) {
          generation.generation_assets = refetched.generation_assets;
        }
      }
    }

    // Most recent session + serialized chat history so the director can resume.
    const { data: session } = await db
      .from("agent_sessions")
      .select("id, messages, current_step, status, updated_at")
      .eq("generation_id", generationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ generation, session });
  } catch (error) {
    console.error("Error fetching generation:", error);
    return NextResponse.json(
      { error: "Failed to fetch generation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { generationId } = await params;

    const { error } = await db
      .from("generations")
      .delete()
      .eq("id", generationId)
      .eq("org_id", auth.orgId);

    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting generation:", error);
    return NextResponse.json(
      { error: "Failed to delete generation" },
      { status: 500 }
    );
  }
}
