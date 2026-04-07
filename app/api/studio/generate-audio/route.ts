import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const { type, prompt, text, brandId, targetDuration } = await request.json();

    if (type === "music") {
      // Generate music via Suno
      const SUNO_API_KEY = process.env.SUNO_API_KEY;
      if (!SUNO_API_KEY) {
        return NextResponse.json({ error: "SUNO_API_KEY not configured" }, { status: 500 });
      }

      const sunoPrompt = `${prompt}. Instrumental only, no vocals. ${targetDuration || 30} seconds long. Perfect for a video advertisement background.`;

      const res = await fetch("https://apibox.erweima.ai/api/v1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUNO_API_KEY}`,
        },
        body: JSON.stringify({
          prompt: sunoPrompt,
          customMode: false,
          instrumental: true,
          model: "V4.5",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Suno API error: ${err}`);
      }

      const data = await res.json();
      const taskId = data.data?.taskId;

      if (!taskId) {
        throw new Error("No taskId returned from Suno");
      }

      // Poll for completion
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 3000));

        const statusRes = await fetch(
          `https://apibox.erweima.ai/api/v1/generate/record?taskId=${taskId}`,
          { headers: { Authorization: `Bearer ${SUNO_API_KEY}` } }
        );

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          const records = statusData.data?.response?.sunoData || statusData.data?.data || [];
          const completed = records.find(
            (r: { status: string; audioUrl?: string }) => r.status === "complete" && r.audioUrl
          );

          if (completed) {
            return NextResponse.json({
              url: completed.audioUrl,
              title: completed.title || "Background Music",
              duration: completed.duration || targetDuration || 30,
            });
          }
        }
      }

      throw new Error("Music generation timed out");
    }

    if (type === "voiceover") {
      // Generate voiceover via ElevenLabs
      const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (!ELEVENLABS_API_KEY) {
        return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
      }

      if (!text) {
        return NextResponse.json({ error: "text is required for voiceover" }, { status: 400 });
      }

      // Use a default voice — Rachel (professional female)
      const voiceId = "21m00Tcm4TlvDq8ikWAM";

      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`ElevenLabs error: ${err}`);
      }

      // Upload audio to Supabase storage
      const { db } = await import("@/lib/db");
      const audioBuffer = await res.arrayBuffer();
      const fileName = `studio-vo-${Date.now()}.mp3`;

      // Ensure bucket exists
      await db.storage.createBucket("voiceovers", {
        public: true,
        allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/mp3"],
      });

      const { error: uploadError } = await db.storage
        .from("voiceovers")
        .upload(fileName, audioBuffer, { contentType: "audio/mpeg", upsert: true });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = db.storage.from("voiceovers").getPublicUrl(fileName);

      // Estimate duration: ~150 words per minute
      const wordCount = text.split(/\s+/).length;
      const estimatedDuration = Math.ceil((wordCount / 150) * 60);

      return NextResponse.json({
        url: publicUrlData.publicUrl,
        duration: estimatedDuration,
      });
    }

    return NextResponse.json({ error: "Invalid type. Use 'music' or 'voiceover'" }, { status: 400 });
  } catch (error) {
    console.error("[api:studio:generate-audio] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audio generation failed" },
      { status: 500 }
    );
  }
}
