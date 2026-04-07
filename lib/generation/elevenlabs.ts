const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

export type Voice = {
  voice_id: string;
  name: string;
  labels: Record<string, string>;
  preview_url: string;
};

export async function textToSpeech(
  text: string,
  voiceId: string,
  options: {
    model?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
  } = {}
): Promise<ArrayBuffer> {
  const {
    model = "eleven_v3",
    stability = 0.45,
    similarityBoost = 0.75,
    style = 0.1,
    speed = 1.0,
  } = options;

  const voiceSettings: Record<string, unknown> = {
    stability,
    similarity_boost: similarityBoost,
    style,
  };

  // use_speaker_boost is NOT supported on eleven_v3
  if (model !== "eleven_v3") {
    voiceSettings.use_speaker_boost = true;
  }

  const body: Record<string, unknown> = {
    text,
    model_id: model,
    voice_settings: voiceSettings,
  };

  // Speed control (0.7 - 1.2)
  if (speed !== 1.0) {
    body.speed = Math.max(0.7, Math.min(1.2, speed));
  }

  console.log(`[elevenlabs] TTS model=${model} voice=${voiceId} stability=${stability} style=${style} speed=${speed}`);

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  return response.arrayBuffer();
}

export async function getVoices(): Promise<Voice[]> {
  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
    },
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  const data = await response.json();
  return data.voices;
}
