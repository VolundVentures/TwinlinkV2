/**
 * Transcription via Replicate Whisper (openai/whisper).
 * Returns word-level timestamps for animated captions.
 */

import { trackCost } from "./cost-tracker";
import { runModel } from "./replicate";

type WhisperOutput = {
  transcription?: string;
  detected_language?: string;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    words?: Array<{ word: string; start: number; end: number }>;
  }>;
};

export type TranscriptionResult = {
  text: string;
  words: Array<{ word: string; startMs: number; endMs: number }>;
  language: string;
};

const WHISPER_MODEL = "openai/whisper";

/**
 * Transcribe audio/video using Whisper via Replicate.
 * Returns word-level timestamps when available, falling back to estimated
 * timings when the model only returns segments.
 */
export async function transcribeAudio(
  audioOrVideoUrl: string,
  options: { language?: string; generationId?: string } = {}
): Promise<TranscriptionResult> {
  const { language, generationId } = options;

  console.log("[transcription] Transcribing:", audioOrVideoUrl.slice(0, 80));

  const input: Record<string, unknown> = {
    audio: audioOrVideoUrl,
    word_timestamps: true,
  };
  if (language) input.language = language;

  const { output } = await runModel<WhisperOutput>(WHISPER_MODEL, input, {
    maxWaitMs: 300_000,
  });

  if (generationId) {
    trackCost(generationId, "openai/whisper", 1, "Audio transcription");
  }

  const data = output || {};
  const rawText = data.transcription || "";
  const rawLanguage = data.detected_language || "en";
  const words: TranscriptionResult["words"] = [];

  const segments = data.segments || [];
  for (const segment of segments) {
    if (segment.words?.length) {
      for (const w of segment.words) {
        words.push({
          word: (w.word || "").trim(),
          startMs: Math.round((w.start || 0) * 1000),
          endMs: Math.round((w.end || 0) * 1000),
        });
      }
    } else {
      const segText = (segment.text || "").trim();
      const segWords = segText.split(/\s+/).filter(Boolean);
      if (!segWords.length) continue;
      const segStart = segment.start || 0;
      const segEnd = segment.end || segStart + 1;
      const wordDuration = (segEnd - segStart) / segWords.length;
      segWords.forEach((word, i) => {
        words.push({
          word,
          startMs: Math.round((segStart + i * wordDuration) * 1000),
          endMs: Math.round((segStart + (i + 1) * wordDuration) * 1000),
        });
      });
    }
  }

  if (words.length === 0 && rawText) {
    const textWords = rawText.trim().split(/\s+/).filter(Boolean);
    const wordDurationMs = 450;
    const gapMs = 100;
    textWords.forEach((word, i) => {
      words.push({
        word,
        startMs: i * (wordDurationMs + gapMs),
        endMs: i * (wordDurationMs + gapMs) + wordDurationMs,
      });
    });
  }

  console.log(
    "[transcription] Transcribed:",
    words.length,
    "words, language:",
    rawLanguage
  );

  return { text: rawText, words, language: rawLanguage };
}

export function generateSRT(transcription: TranscriptionResult): string {
  const lines: string[] = [];
  let counter = 1;
  const chunkSize = 5;
  for (let i = 0; i < transcription.words.length; i += chunkSize) {
    const chunk = transcription.words.slice(i, i + chunkSize);
    const startMs = chunk[0].startMs;
    const endMs = chunk[chunk.length - 1].endMs;
    const text = chunk.map((w) => w.word).join(" ");
    lines.push(String(counter));
    lines.push(`${formatSRTTime(startMs)} --> ${formatSRTTime(endMs)}`);
    lines.push(text);
    lines.push("");
    counter++;
  }
  return lines.join("\n");
}

function formatSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
}
function pad(num: number, size: number): string {
  return String(num).padStart(size, "0");
}
