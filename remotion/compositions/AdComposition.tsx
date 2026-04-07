import React, { useMemo } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Img,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  spring,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
// createTikTokStyleCaptions replaced with manual word grouping for precise control
import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import type { AdCompositionProps, TextOverlayInput, BrandWatermark, CaptionWord } from "../lib/types";

// ============================================
// Main Composition
// ============================================

export const AdComposition: React.FC<AdCompositionProps> = ({
  clips,
  audio,
  backgroundMusic,
  captions,
  textOverlays,
  brandWatermark,
  transition,
  filmGrain = true,
  fps: propFps,
}) => {
  const { fps } = useVideoConfig();
  const transitionDuration = transition === "cut" ? 0 : Math.round(fps * 0.5);

  // Calculate ACTUAL total duration accounting for crossfade overlap
  const actualDurationFrames = useMemo(() => {
    if (clips.length === 0) return 0;
    const rawTotal = clips.reduce((sum, c) => sum + c.durationFrames, 0);
    const overlapFrames = Math.max(0, clips.length - 1) * transitionDuration;
    return rawTotal - overlapFrames;
  }, [clips, transitionDuration]);

  // Build clip start positions on the ACTUAL timeline (accounting for transitions)
  const clipStartFrames = useMemo(() => {
    const starts: number[] = [];
    let pos = 0;
    for (let i = 0; i < clips.length; i++) {
      starts.push(pos);
      pos += clips[i].durationFrames - (i < clips.length - 1 ? transitionDuration : 0);
    }
    return starts;
  }, [clips, transitionDuration]);

  // Build frame-level map of LIPSYNC clip ranges for voiceover muting
  // Uses actual timeline positions, correct for both cut and crossfade
  const lipsyncFrameRanges = useMemo(() => {
    const ranges: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < clips.length; i++) {
      if (clips[i].isLipsync) {
        ranges.push({
          start: clipStartFrames[i],
          end: clipStartFrames[i] + clips[i].durationFrames,
        });
      }
    }
    return ranges;
  }, [clips, clipStartFrames]);

  // Voiceover volume: mute during lipsync clips, full during everything else
  const voiceoverVolume = (frame: number): number => {
    const baseVolume = audio?.volume ?? 0.85;
    for (const range of lipsyncFrameRanges) {
      if (frame >= range.start && frame < range.end) return 0;
    }
    return baseVolume;
  };

  // Background music: fade in 0.5s, steady, fade out last 2s
  const musicVolume = (frame: number): number => {
    const baseVolume = backgroundMusic?.volume ?? 0.15;
    const fadeInFrames = Math.round(fps * 0.5);
    const fadeOutFrames = Math.round(fps * 2);

    // Guard: video shorter than fade duration
    if (actualDurationFrames <= fadeInFrames + fadeOutFrames) {
      return baseVolume;
    }

    const fadeOutStart = actualDurationFrames - fadeOutFrames;

    if (frame < fadeInFrames) {
      return interpolate(frame, [0, fadeInFrames], [0, baseVolume], { extrapolateRight: "clamp" });
    }
    if (frame >= fadeOutStart) {
      return interpolate(frame, [fadeOutStart, actualDurationFrames], [baseVolume, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    }
    return baseVolume;
  };

  // Clip native audio volume based on clip type
  const getClipVolume = (clipIndex: number): number | ((frame: number) => number) => {
    const clip = clips[clipIndex];
    if (!clip.hasOwnAudio) return 0; // No audio at all

    // Lipsync clips: full volume
    if (clip.isLipsync) return 1.0;

    // Regular clips with ambient audio: low ambient texture
    // Duck further when voiceover is present
    if (audio?.url) return 0.06;
    return 0.15;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Video/Image clips */}
      {transition === "cut" ? (
        <CutSequence clips={clips} getClipVolume={getClipVolume} />
      ) : (
        <CrossfadeSequence clips={clips} transitionDuration={transitionDuration} getClipVolume={getClipVolume} />
      )}

      {/* Voiceover audio — starts at frame 0, muted during lipsync clips */}
      {audio?.url && (
        <Sequence from={audio.startFrame || 0} durationInFrames={audio.durationFrames || actualDurationFrames}>
          <Audio src={audio.url} volume={voiceoverVolume} />
        </Sequence>
      )}

      {/* Background music — plays from frame 0, fades out at end */}
      {backgroundMusic?.url && (
        <Sequence from={0} durationInFrames={actualDurationFrames}>
          <Audio src={backgroundMusic.url} volume={musicVolume} />
        </Sequence>
      )}

      {/* Text overlays */}
      {textOverlays?.map((overlay, i) => (
        <Sequence key={`text-${i}`} from={overlay.startFrame} durationInFrames={overlay.endFrame - overlay.startFrame}>
          <TextOverlay overlay={overlay} />
        </Sequence>
      ))}

      {/* TikTok-style animated captions */}
      {captions && captions.length > 0 && (
        <CaptionPages captions={captions} fps={fps} />
      )}

      {/* Brand watermark */}
      {brandWatermark && <Watermark watermark={brandWatermark} />}

      {/* Subtle film grain */}
      {filmGrain && <FilmGrainOverlay />}
    </AbsoluteFill>
  );
};

// ============================================
// Clip Sequences
// ============================================

const CutSequence: React.FC<{
  clips: AdCompositionProps["clips"];
  getClipVolume: (clipIndex: number) => number | ((frame: number) => number);
}> = ({ clips, getClipVolume }) => {
  let currentFrame = 0;
  return (
    <>
      {clips.map((clip, i) => {
        const from = currentFrame;
        currentFrame += clip.durationFrames;
        return (
          <Sequence key={`clip-${i}`} from={from} durationInFrames={clip.durationFrames}>
            <AbsoluteFill>
              {clip.type === "video" ? (
                <OffthreadVideo
                  src={clip.url}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  volume={getClipVolume(i)}
                />
              ) : (
                <Img src={clip.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};

const CrossfadeSequence: React.FC<{
  clips: AdCompositionProps["clips"];
  transitionDuration: number;
  getClipVolume: (clipIndex: number) => number | ((frame: number) => number);
}> = ({ clips, transitionDuration, getClipVolume }) => {
  return (
    <TransitionSeries>
      {clips.map((clip, i) => (
        <React.Fragment key={`transition-clip-${i}`}>
          <TransitionSeries.Sequence durationInFrames={clip.durationFrames}>
            <AbsoluteFill>
              {clip.type === "video" ? (
                <OffthreadVideo
                  src={clip.url}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  volume={getClipVolume(i)}
                />
              ) : (
                <Img src={clip.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </AbsoluteFill>
          </TransitionSeries.Sequence>
          {i < clips.length - 1 && (
            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: transitionDuration })}
            />
          )}
        </React.Fragment>
      ))}
    </TransitionSeries>
  );
};

// ============================================
// TikTok-Style Animated Captions
// ============================================

const WORDS_PER_PAGE = 4;

type CaptionPage = {
  words: CaptionWord[];
  startMs: number;
  endMs: number;
  text: string;
};

const CaptionPages: React.FC<{ captions: CaptionWord[]; fps: number }> = ({ captions, fps }) => {
  const pages = useMemo(() => {
    const result: CaptionPage[] = [];
    for (let i = 0; i < captions.length; i += WORDS_PER_PAGE) {
      const group = captions.slice(i, i + WORDS_PER_PAGE);
      if (group.length === 0) continue;
      result.push({
        words: group,
        startMs: group[0].startMs,
        endMs: group[group.length - 1].endMs,
        text: group.map(w => w.word).join(" "),
      });
    }
    return result;
  }, [captions]);

  return (
    <>
      {pages.map((page, index) => {
        const nextPage = pages[index + 1] ?? null;
        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = nextPage
          ? Math.round((nextPage.startMs / 1000) * fps)
          : startFrame + Math.round(((page.endMs - page.startMs) / 1000) * fps) + Math.round(fps * 0.3);
        const durationInFrames = Math.max(1, endFrame - startFrame);

        return (
          <Sequence key={`caption-page-${index}`} from={startFrame} durationInFrames={durationInFrames}>
            <SubtitlePage page={page} />
          </Sequence>
        );
      })}
    </>
  );
};

const SubtitlePage: React.FC<{ page: CaptionPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 5 });

  return (
    <AbsoluteFill
      style={{
        top: "auto",
        bottom: 120,
        height: "auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 48px",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "3px 6px",
          maxWidth: width * 0.85,
          opacity: interpolate(enter, [0, 1], [0, 1]),
          transform: makeTransform([
            translateY(interpolate(enter, [0, 1], [12, 0])),
          ]),
        }}
      >
        {page.words.map((word, i) => (
          <span
            key={`${page.startMs}-word-${i}`}
            style={{
              fontSize: 42,
              fontWeight: 700,
              fontFamily: "Inter, system-ui, sans-serif",
              color: "#FFFFFF",
              textShadow: "0 1px 8px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.4)",
              display: "inline-block",
            }}
          >
            {word.word}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// Text Overlay
// ============================================

const TextOverlay: React.FC<{ overlay: TextOverlayInput }> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { top: 60, left: 0, right: 0, justifyContent: "center" },
    center: { top: 0, bottom: 0, left: 0, right: 0, justifyContent: "center", alignItems: "center" },
    bottom: { bottom: 120, left: 0, right: 0, justifyContent: "center" },
  };

  return (
    <AbsoluteFill style={{ display: "flex", ...positionStyles[overlay.position], opacity }}>
      <div
        style={{
          fontSize: overlay.style.fontSize,
          color: overlay.style.color,
          fontFamily: overlay.style.fontFamily,
          fontWeight: overlay.style.fontWeight as React.CSSProperties["fontWeight"],
          backgroundColor: overlay.style.backgroundColor || "transparent",
          padding: overlay.style.padding || 16,
          borderRadius: overlay.style.borderRadius || 8,
          textAlign: "center",
          maxWidth: "90%",
          textShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        {overlay.text}
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// Brand Watermark
// ============================================

const Watermark: React.FC<{ watermark: BrandWatermark }> = ({ watermark }) => {
  const positionStyles: Record<string, React.CSSProperties> = {
    "top-left": { top: 30, left: 30 },
    "top-right": { top: 30, right: 30 },
    "bottom-left": { bottom: 30, left: 30 },
    "bottom-right": { bottom: 30, right: 30 },
  };

  const isSafeLogoUrl = watermark.logoUrl && (
    watermark.logoUrl.includes("fal.media") ||
    watermark.logoUrl.includes("supabase.co") ||
    watermark.logoUrl.includes("s3.amazonaws.com") ||
    watermark.logoUrl.includes("s3.us-east")
  );

  return (
    <div style={{ position: "absolute", ...positionStyles[watermark.position], display: "flex", alignItems: "center", gap: 8, opacity: 0.8 }}>
      {isSafeLogoUrl && <Img src={watermark.logoUrl!} style={{ width: 32, height: 32, borderRadius: 4 }} />}
      <span style={{ color: watermark.color, fontSize: 16, fontWeight: 600, fontFamily: "Inter, system-ui, sans-serif", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
        {watermark.text}
      </span>
    </div>
  );
};

// ============================================
// Film Grain Overlay
// ============================================

const FilmGrainOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(Math.floor(frame / 2) * 13.37);
  return (
    <>
      {/* Film grain */}
      <AbsoluteFill
        style={{
          mixBlendMode: "overlay",
          opacity: 0.12,
          background: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' seed='${seed}'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
          backgroundSize: "300px 300px",
          pointerEvents: "none",
        }}
      />
      {/* Subtle vignette — reduced from 0.35 to 0.15 for clarity */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.15) 100%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
};
