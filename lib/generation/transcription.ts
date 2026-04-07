/**
 * Transcription module using fal.ai Whisper for speech-to-text.
 * Returns word-level timestamps for animated captions.
 */

import { trackCost } from "./cost-tracker";
import { falSubmitAndPoll } from "./fal-video";

type WhisperWord = {
  word: string;
  start: number; // seconds
  end: number;   // seconds
};

type WhisperSegment = {
  text: string;
  start: number;
  end: number;
  words?: WhisperWord[];
};

type WhisperResponse = {
  text: string;
  segments: WhisperSegment[];
  language: string;
};

export type TranscriptionResult = {
  text: string;
  words: Array<{ word: string; startMs: number; endMs: number }>;
  language: string;
};

/**
 * Transcribe audio/video using Whisper via fal.ai.
 * Returns word-level timestamps for animated captions.
 */
export async function transcribeAudio(
  audioOrVideoUrl: string,
  options: {
    language?: string;
    generationId?: string;
  } = {}
): Promise<TranscriptionResult> {
  const { language, generationId } = options;

  console.log("[transcription] Transcribing:", audioOrVideoUrl.slice(0, 80));

  const body: Record<string, unknown> = {
    audio_url: audioOrVideoUrl,
    task: "transcribe",
    chunk_level: "word",  // "word" returns per-word timestamps for animated captions
  };

  if (language) {
    body.language = language;
  }

  // Use queue API to avoid Node.js undici 120s timeout
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await falSubmitAndPoll<Record<string, unknown>>(
    "fal-ai/whisper",
    body,
    undefined,
    120_000
  );

  console.log("[transcription] Whisper response keys:", Object.keys(data));

  if (generationId) {
    trackCost(generationId, "fal-ai/whisper", 1, "Audio transcription");
  }

  // fal.ai Whisper returns different structures depending on version:
  // Standard: { text, segments: [{ text, start, end, words: [{ word, start, end }] }] }
  // fal.ai v3: { text, chunks: [{ text, timestamp: [start, end] }], inferred_languages }
  const rawText = data.text || data.output?.text || "";
  const rawLanguage = data.language || data.inferred_languages?.[0] || data.output?.language || "en";

  const words: TranscriptionResult["words"] = [];

  // Try standard segments format first
  const segments = data.segments || data.output?.segments;
  if (Array.isArray(segments) && segments.length > 0) {
    for (const segment of segments) {
      if (segment.words && Array.isArray(segment.words)) {
        for (const w of segment.words) {
          words.push({
            word: (w.word || "").trim(),
            startMs: Math.round((w.start || 0) * 1000),
            endMs: Math.round((w.end || 0) * 1000),
          });
        }
      } else {
        // Segment without word-level timestamps — estimate
        const segText = (segment.text || "").trim();
        const segWords = segText.split(/\s+/).filter(Boolean);
        if (segWords.length === 0) continue;
        const segStart = segment.start || 0;
        const segEnd = segment.end || segStart + 1;
        const wordDuration = (segEnd - segStart) / segWords.length;
        segWords.forEach((word: string, i: number) => {
          words.push({
            word,
            startMs: Math.round((segStart + i * wordDuration) * 1000),
            endMs: Math.round((segStart + (i + 1) * wordDuration) * 1000),
          });
        });
      }
    }
  }

  // Try fal.ai chunks format: { text, timestamp: [start, end] }
  if (words.length === 0 && Array.isArray(data.chunks) && data.chunks.length > 0) {
    console.log("[transcription] Using chunks format, count:", data.chunks.length);
    for (const chunk of data.chunks) {
      const chunkText = (chunk.text || "").trim();
      const chunkWords = chunkText.split(/\s+/).filter(Boolean);
      if (chunkWords.length === 0) continue;

      // chunks use timestamp: [start_seconds, end_seconds]
      const chunkStart = Array.isArray(chunk.timestamp)
        ? chunk.timestamp[0] || 0
        : chunk.start || 0;
      const chunkEnd = Array.isArray(chunk.timestamp)
        ? chunk.timestamp[1] || chunkStart + 1
        : chunk.end || chunkStart + 1;

      // Add small gaps between words so caption grouping can detect boundaries
      const gapSeconds = 0.05; // 50ms gap between words
      const totalGaps = (chunkWords.length - 1) * gapSeconds;
      const availableDuration = (chunkEnd - chunkStart) - totalGaps;
      const wordDuration = Math.max(0.1, availableDuration / chunkWords.length);
      chunkWords.forEach((word: string, i: number) => {
        const wordStart = chunkStart + i * (wordDuration + gapSeconds);
        words.push({
          word,
          startMs: Math.round(wordStart * 1000),
          endMs: Math.round((wordStart + wordDuration) * 1000),
        });
      });
    }
  }

  // Last resort: if still no words, estimate from raw text
  if (words.length === 0 && rawText) {
    const textWords = rawText.trim().split(/\s+/).filter(Boolean);
    // Assume ~2 words/sec with gaps between words for caption grouping
    const wordDurationMs = 450;
    const gapMs = 100; // 100ms gap between words
    textWords.forEach((word: string, i: number) => {
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

  return {
    text: rawText,
    words,
    language: rawLanguage,
  };
}

/**
 * Generate SRT subtitle file content from transcription.
 */
export function generateSRT(transcription: TranscriptionResult): string {
  const lines: string[] = [];
  let counter = 1;

  // Group words into ~5-word chunks for SRT
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
