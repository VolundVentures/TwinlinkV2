import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateJSON } from "@/lib/ai/claude";
import type { ScriptScene } from "@/components/studio/studio-types";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const { prompt, tone, platform, targetDuration, brandId } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    // Fetch brand context if available
    let brandContext = "";
    if (brandId) {
      const { data: brand } = await db
        .from("brands")
        .select("name, description, industry, target_audience, brand_voice")
        .eq("id", brandId)
        .single();

      if (brand) {
        brandContext = `\nBrand: ${brand.name}\nIndustry: ${brand.industry || "N/A"}\nTarget: ${brand.target_audience || "N/A"}\nVoice: ${brand.brand_voice || "N/A"}\nDescription: ${brand.description || "N/A"}`;
      }
    }

    // Calculate scene count based on target duration
    const avgSceneDuration = platform === "tiktok" ? 3 : 5;
    const sceneCount = Math.max(3, Math.min(12, Math.round(targetDuration / avgSceneDuration)));

    const result = await generateJSON<{ scenes: ScriptScene[] }>({
      model: "claude-sonnet-4-20250514",
      maxTokens: 2000,
      system: "You are a professional video ad scriptwriter. Return structured JSON.",
      messages: [
        {
          role: "user",
          content: `Create a structured script for a ${targetDuration}-second ${tone} video ad.
${brandContext}

User's vision: "${prompt}"

Platform: ${platform}
Tone: ${tone}
Target duration: ${targetDuration} seconds
Target scene count: ${sceneCount} scenes

Return a JSON object with a "scenes" key containing an array. Each scene has:
- id: unique string (scene-1, scene-2, etc.)
- sceneNumber: integer
- title: short scene title (3-5 words)
- description: brief scene description
- dialog: voiceover/dialog text for this scene (can be empty for purely visual scenes)
- visualDirection: camera angles, movement, lighting, composition
- durationSeconds: estimated duration (total should sum to ~${targetDuration}s)
- transition: "cut" | "crossfade" | "dissolve" | "fade_to_black"

Make it creative, specific, and production-ready. Include diverse camera angles and movements.
First scene should be a strong hook. Last scene should be a clear CTA.`,
        },
      ],
    });

    return NextResponse.json({ scenes: result.scenes || [] });
  } catch (error) {
    console.error("[api:studio:generate-script] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate script" },
      { status: 500 }
    );
  }
}
