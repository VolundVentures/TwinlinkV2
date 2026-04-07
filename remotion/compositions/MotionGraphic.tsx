import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
} from "remotion";
import type { MotionGraphicProps, StatItem, FeatureItem } from "../lib/types";

export const MotionGraphic: React.FC<MotionGraphicProps> = (props) => {
  switch (props.type) {
    case "stat_counter":
      return <StatCounter {...props} />;
    case "feature_highlight":
      return <FeatureHighlight {...props} />;
    case "kinetic_type":
      return <KineticType {...props} />;
    case "product_launch":
      return <ProductLaunch {...props} />;
    case "pitch_deck":
      return <PitchDeck {...props} />;
    default:
      return <StatCounter {...props} />;
  }
};

// === STAT COUNTER ===
const StatCounter: React.FC<MotionGraphicProps> = ({
  title,
  stats = [],
  brandColor,
  accentColor,
  backgroundColor,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Title fade in
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 20], [30, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        fontFamily: `${fontFamily}, system-ui, sans-serif`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: brandColor,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          marginBottom: 60,
          textAlign: "center",
        }}
      >
        {title}
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 40,
          width: "100%",
        }}
      >
        {stats.map((stat, i) => (
          <Sequence key={`stat-${i}`} from={20 + i * 15}>
            <AnimatedStat
              stat={stat}
              index={i}
              brandColor={brandColor}
              accentColor={accentColor}
              fontFamily={fontFamily}
              totalFrames={durationInFrames - (20 + i * 15)}
              fps={fps}
            />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const AnimatedStat: React.FC<{
  stat: StatItem;
  index: number;
  brandColor: string;
  accentColor: string;
  fontFamily: string;
  totalFrames: number;
  fps: number;
}> = ({ stat, brandColor, accentColor, fontFamily, fps }) => {
  const frame = useCurrentFrame();

  // Spring animation for the number
  const progress = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 50, mass: 1 },
  });

  const count = Math.round(interpolate(progress, [0, 1], [0, stat.value]));
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 15], [0.8, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Format number with commas
  const formatted = count.toLocaleString();

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        textAlign: "center",
        minWidth: 200,
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 900,
          color: stat.color || accentColor,
          fontFamily: `${fontFamily}, system-ui, sans-serif`,
          lineHeight: 1.1,
        }}
      >
        {stat.prefix || ""}
        {formatted}
        {stat.suffix || ""}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: brandColor,
          marginTop: 8,
          opacity: 0.8,
          fontFamily: `${fontFamily}, system-ui, sans-serif`,
        }}
      >
        {stat.label}
      </div>
    </div>
  );
};

// === FEATURE HIGHLIGHT ===
const FeatureHighlight: React.FC<MotionGraphicProps> = ({
  title,
  features = [],
  brandColor,
  accentColor,
  backgroundColor,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 100 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        fontFamily: `${fontFamily}, system-ui, sans-serif`,
        padding: 80,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: brandColor,
          opacity: titleProgress,
          transform: `translateX(${interpolate(titleProgress, [0, 1], [-50, 0])}px)`,
          marginBottom: 50,
        }}
      >
        {title}
      </div>

      {/* Features list with staggered entrance */}
      {features.map((feature, i) => (
        <Sequence key={`feature-${i}`} from={30 + i * 25}>
          <FeatureCard
            feature={feature}
            index={i}
            brandColor={brandColor}
            accentColor={accentColor}
            fontFamily={fontFamily}
            fps={fps}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const FeatureCard: React.FC<{
  feature: FeatureItem;
  index: number;
  brandColor: string;
  accentColor: string;
  fontFamily: string;
  fps: number;
}> = ({ feature, brandColor, accentColor, fontFamily, fps }) => {
  const frame = useCurrentFrame();
  const progress = spring({ frame, fps, config: { damping: 80 } });

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
        display: "flex",
        alignItems: "flex-start",
        gap: 20,
        marginBottom: 30,
        padding: 24,
        borderLeft: `4px solid ${accentColor}`,
        backgroundColor: `${brandColor}08`,
        borderRadius: 8,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: brandColor,
            fontFamily: `${fontFamily}, system-ui, sans-serif`,
          }}
        >
          {feature.title}
        </div>
        <div
          style={{
            fontSize: 20,
            color: `${brandColor}CC`,
            marginTop: 6,
            fontFamily: `${fontFamily}, system-ui, sans-serif`,
            lineHeight: 1.4,
          }}
        >
          {feature.description}
        </div>
      </div>
    </div>
  );
};

// === KINETIC TYPE ===
const KineticType: React.FC<MotionGraphicProps> = ({
  textLines = [],
  brandColor,
  accentColor,
  backgroundColor,
  fontFamily,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const framesPerLine = Math.floor(durationInFrames / Math.max(textLines.length, 1));

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        fontFamily: `${fontFamily}, system-ui, sans-serif`,
      }}
    >
      {textLines.map((line, i) => (
        <Sequence
          key={`line-${i}`}
          from={i * framesPerLine}
          durationInFrames={framesPerLine}
        >
          <KineticLine
            text={line}
            index={i}
            total={textLines.length}
            brandColor={brandColor}
            accentColor={accentColor}
            fontFamily={fontFamily}
            fps={fps}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const KineticLine: React.FC<{
  text: string;
  index: number;
  total: number;
  brandColor: string;
  accentColor: string;
  fontFamily: string;
  fps: number;
}> = ({ text, index, total, brandColor, accentColor, fontFamily, fps }) => {
  const frame = useCurrentFrame();

  const enterProgress = spring({
    frame,
    fps,
    config: { damping: 60, stiffness: 80 },
  });

  // Use accent color for emphasis words (every other line)
  const color = index % 2 === 0 ? brandColor : accentColor;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          fontSize: Math.min(96, 800 / Math.max(text.length, 1) * 10),
          fontWeight: 900,
          color,
          textAlign: "center",
          lineHeight: 1.1,
          fontFamily: `${fontFamily}, system-ui, sans-serif`,
          opacity: enterProgress,
          transform: `scale(${interpolate(enterProgress, [0, 1], [0.7, 1])})`,
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// === PRODUCT LAUNCH (placeholder — extends with product image + 3D later) ===
const ProductLaunch: React.FC<MotionGraphicProps> = (props) => {
  // For now, combines stat counter + feature highlight
  return <StatCounter {...props} />;
};

// === PITCH DECK (placeholder — extends with slide transitions) ===
const PitchDeck: React.FC<MotionGraphicProps> = (props) => {
  return <FeatureHighlight {...props} />;
};
