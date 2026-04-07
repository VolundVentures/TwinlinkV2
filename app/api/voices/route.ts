import { NextResponse } from "next/server";

// Simple in-memory cache
let cachedVoices: unknown[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
};

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ voices: [] });
  }

  // Return cached data if still fresh
  const now = Date.now();
  if (cachedVoices && now - cacheTimestamp < CACHE_DURATION_MS) {
    return NextResponse.json({ voices: cachedVoices });
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=50", {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!res.ok) {
      // Fallback: try v1 endpoint
      const v1Res = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: {
          "xi-api-key": apiKey,
        },
      });

      if (!v1Res.ok) {
        console.error("ElevenLabs API error:", v1Res.status);
        return NextResponse.json({ voices: cachedVoices || [] });
      }

      const v1Data = await v1Res.json();
      const voices = (v1Data.voices || []).map((v: ElevenLabsVoice) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category || "general",
        labels: v.labels || {},
        previewUrl: v.preview_url || "",
      }));

      cachedVoices = voices;
      cacheTimestamp = now;

      return NextResponse.json({ voices });
    }

    const data = await res.json();
    const voices = (data.voices || []).map((v: ElevenLabsVoice) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category || "general",
      labels: v.labels || {},
      previewUrl: v.preview_url || "",
    }));

    cachedVoices = voices;
    cacheTimestamp = now;

    return NextResponse.json({ voices });
  } catch (err) {
    console.error("Failed to fetch ElevenLabs voices:", err);
    return NextResponse.json({ voices: cachedVoices || [] });
  }
}
