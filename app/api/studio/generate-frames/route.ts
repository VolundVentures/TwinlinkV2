import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { STYLE_PRESETS } from "@/components/studio/studio-types";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const { scene, sceneIndex, style, brandId, previousLastFrame } = await request.json();

    if (!scene) {
      return NextResponse.json({ error: "scene is required" }, { status: 400 });
    }

    // Get style prompt anchors
    const stylePreset = STYLE_PRESETS.find((s) => s.id === style);
    const styleAnchors = stylePreset?.promptAnchors.join(", ") || "cinematic, professional";

    // Build image generation prompts
    const firstFramePrompt = [
      scene.visualDirection || scene.description,
      `Opening of scene: ${scene.title}`,
      styleAnchors,
      "high quality, 4K, professional cinematography",
    ].join(". ");

    const lastFramePrompt = [
      scene.visualDirection || scene.description,
      `End of scene: ${scene.title}`,
      styleAnchors,
      "high quality, 4K, professional cinematography",
    ].join(". ");

    // Generate both frames using fal.ai (Nano Banana 2)
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    }

    const generateImage = async (prompt: string, referenceUrl?: string) => {
      const body: Record<string, unknown> = {
        prompt,
        num_images: 1,
        image_size: { width: 1280, height: 720 },
        output_format: "jpeg",
        guidance_scale: 7.5,
      };

      // If we have a reference frame (for continuity), use img2img
      if (referenceUrl) {
        body.image_url = referenceUrl;
        body.strength = 0.6; // Keep 40% of reference for continuity
      }

      const res = await fetch("https://queue.fal.run/fal-ai/flux/dev", {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Image generation failed: ${err}`);
      }

      const data = await res.json();

      // Handle queued response — poll for result
      if (data.request_id) {
        // Poll for completion
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const statusRes = await fetch(
            `https://queue.fal.run/fal-ai/flux/dev/requests/${data.request_id}/status`,
            { headers: { Authorization: `Key ${FAL_KEY}` } }
          );
          const statusData = await statusRes.json();
          if (statusData.status === "COMPLETED") {
            const resultRes = await fetch(
              `https://queue.fal.run/fal-ai/flux/dev/requests/${data.request_id}`,
              { headers: { Authorization: `Key ${FAL_KEY}` } }
            );
            const resultData = await resultRes.json();
            return resultData.images?.[0]?.url || null;
          }
          if (statusData.status === "FAILED") {
            throw new Error("Image generation failed");
          }
        }
        throw new Error("Image generation timed out");
      }

      return data.images?.[0]?.url || null;
    };

    // Generate first frame (use previous scene's last frame as reference for continuity)
    const [firstFrameUrl, lastFrameUrl] = await Promise.all([
      generateImage(firstFramePrompt, previousLastFrame || undefined),
      generateImage(lastFramePrompt),
    ]);

    return NextResponse.json({
      firstFrame: firstFrameUrl ? { url: firstFrameUrl, prompt: firstFramePrompt } : null,
      lastFrame: lastFrameUrl ? { url: lastFrameUrl, prompt: lastFramePrompt } : null,
    });
  } catch (error) {
    console.error("[api:studio:generate-frames] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate frames" },
      { status: 500 }
    );
  }
}
