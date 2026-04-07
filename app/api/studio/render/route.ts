import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { renderComposition } from "@/lib/generation/remotion-render";
import type { AdCompositionProps } from "@/remotion/lib/types";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const {
      scenes,
      frames,
      audioLayers,
      style,
      format = "mp4",
      quality = "1080p",
      targetPlatform,
    } = await request.json();

    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ error: "At least one scene is required" }, { status: 400 });
    }

    const fps = 30;

    // Build clips from frames
    const clips = scenes.map((scene: { durationSeconds: number; title: string }, i: number) => {
      const framePair = frames?.find((f: { sceneIndex: number }) => f.sceneIndex === i);
      const imageUrl = framePair?.firstFrame?.url || framePair?.lastFrame?.url;

      return {
        url: imageUrl || "",
        type: imageUrl ? "image" : "image",
        durationFrames: Math.round(scene.durationSeconds * fps),
        label: scene.title || `scene-${i + 1}`,
        hasOwnAudio: false,
      };
    }).filter((clip: { url: string }) => clip.url);

    if (clips.length === 0) {
      return NextResponse.json(
        { error: "No frames generated. Generate frames for your scenes first." },
        { status: 400 }
      );
    }

    // Build composition props
    const compositionProps: AdCompositionProps = {
      clips,
      transition: "crossfade",
      fps,
    };

    // Add voiceover if present
    const voiceover = audioLayers?.find((l: { type: string }) => l.type === "voiceover");
    if (voiceover?.url) {
      compositionProps.audio = {
        url: voiceover.url,
        volume: voiceover.volume || 0.85,
        startFrame: 0,
      };
    }

    // Add background music if present
    const music = audioLayers?.find((l: { type: string }) => l.type === "music");
    if (music?.url) {
      compositionProps.backgroundMusic = {
        url: music.url,
        volume: music.volume || 0.15,
      };
    }

    // Determine aspect ratio from platform
    const aspectRatio = targetPlatform === "youtube" ? "16:9"
      : targetPlatform === "instagram_feed" ? "1:1"
      : "9:16";

    const compositionId = aspectRatio === "16:9"
      ? "AdComposition-Landscape"
      : aspectRatio === "1:1"
        ? "AdComposition-Square"
        : "AdComposition";

    // Render via Remotion Lambda
    const result = await renderComposition({
      compositionId,
      inputProps: compositionProps as unknown as Record<string, unknown>,
      format: "mp4",
      generationId: `studio-${Date.now()}`,
    });

    return NextResponse.json({
      url: result.url,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error("[api:studio:render] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Render failed" },
      { status: 500 }
    );
  }
}
