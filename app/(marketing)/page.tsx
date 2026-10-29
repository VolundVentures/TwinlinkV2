"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { ArrowRight, ArrowUpRight, Play } from "lucide-react";
import { LandingNav } from "./components/landing-nav";
import { Reveal, SplitHeading, Stagger, StaggerItem } from "./components/reveal";
import { Marquee } from "./components/marquee";
import { FilmTile } from "./components/film-tile";
import { Cursor } from "./components/cursor";
import { Magnetic } from "./components/magnetic";
import { Counter } from "./components/counter";
import { ScrollProgress } from "./components/scroll-progress";
import { ScrollBadge } from "./components/scroll-badge";
import { HorizontalGallery } from "./components/horizontal-gallery";

// Real assets shipping with the build. Posters are intentionally undefined —
// the gradient + grain fallback renders while the video loads, matching the
// editorial "Monolith Gallery" intent.
const A = {
  heroVideo: "/videos/grizzlies.mp4",
  films: [
    {
      src: "/videos/grizzlies.mp4",
      label: "Short film · Anamorphic",
      title: "Grizzlies",
      meta: "AI short · 21:9 · Noir",
      aspect: "aspect-[16/9]",
    },
    {
      src: "/videos/dream-big.mp4",
      label: "Brand film · Aspirational",
      title: "Dream Big",
      meta: "60s · 16:9 · Editorial",
      aspect: "aspect-[4/5]",
    },
    {
      src: "/videos/garage-pizza.mp4",
      label: "Hospitality · Documentary",
      title: "Garage Pizza",
      meta: "90s · 16:9 · Vérité",
      aspect: "aspect-[3/4]",
    },
    {
      src: "/videos/runway-android.mp4",
      label: "Tech · Product film",
      title: "Now on Android",
      meta: "30s · 9:16 · Hero",
      aspect: "aspect-[3/4]",
    },
  ],
  split: "/videos/dream-big.mp4",
  closing: "/videos/garage-pizza.mp4",
};

// Featured directors surfaced in the casting strip. These match
// /lib/directors/personas — keep the slugs in sync if you swap personas.
const FEATURED_DIRECTORS = [
  { id: "yuki-sato", name: "Yuki Sato", school: "Hong Kong romantic atmospherics" },
  { id: "marcel-vrai", name: "Marcel Vraí", school: "French New Wave" },
  { id: "nadia-camillo", name: "Nadia Camillo", school: "Italian neorealism" },
  { id: "kaito-mori", name: "Kaito Mori", school: "Tokyo street poetics" },
  { id: "edgar-loomis", name: "Edgar Loomis", school: "American gothic" },
  { id: "zara-okafor", name: "Zara Okafor", school: "Lagos magic realism" },
  { id: "henrik-aalto", name: "Henrik Aalto", school: "Nordic minimalism" },
  { id: "catarina-reis", name: "Catarina Reis", school: "Iberian melodrama" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Cursor />
      <ScrollProgress />
      <LandingNav />
      <HeroSection />
      <KeywordMarquee />
      <ManifestoSection />
      <CastingSection />
      <ReelSection />
      <InsideStudioSection />
      <MethodSection />
      <SplitFeatureSection />
      <DisciplinesMarquee />
      <QuoteSection />
      <PricingSection />
      <ClosingSection />
      <Footer />
    </div>
  );
}

function InsideStudioSection() {
  return (
    <HorizontalGallery
      panels={[
        {
          label: "Casting",
          title: "Cast your director.",
          body:
            "Twenty fictional auteurs, each with a school of cinema and a body of work. Pick one or two — they direct the film with you from pitch to premiere.",
          meta: "01 · Cast",
          poster: "/directors/yuki-sato.png",
        },
        {
          label: "Treatment",
          title: "They pitch you back.",
          body:
            "One image becomes a treatment — location, color script, camera language, the music in their head. Approve it or push back. They argue for the film they want to make.",
          meta: "02 · Treatment",
          video: "/videos/dream-big.mp4",
        },
        {
          label: "Plates & Keyframes",
          title: "Frames before motion.",
          body:
            "Identity-locked plates of cast, locations, wardrobe, props. Composited into stills before any second of motion is rendered. Cannes-tier craft is decided here, not in the prompt.",
          meta: "03 · Keyframes",
          video: "/videos/grizzlies.mp4",
        },
        {
          label: "The Cut",
          title: "Scored, graded, shipped.",
          body:
            "Every approved frame becomes a directed shot. Cut, scored, grain pass, LUT, letterbox. Mastered at 4K and exported for any aspect, any channel — without leaving the tab.",
          meta: "04 · Cut",
          video: "/videos/garage-pizza.mp4",
        },
      ]}
    />
  );
}

/* =========================================================================
   HERO — fullbleed autoplay video, massive serif, parallax mask
   ========================================================================= */
function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0.35, 0.75]);

  return (
    <section
      ref={ref}
      className="relative h-[100svh] min-h-[680px] w-full overflow-hidden bg-black text-white"
    >
      {/* Video */}
      <motion.div
        style={reduce ? undefined : { y: videoY, scale: videoScale }}
        className="absolute inset-0"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.08), transparent 55%), linear-gradient(180deg, #111 0%, #000 100%)",
          }}
        />
        <video
          src={A.heroVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover grayscale"
        />
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(0,0,0,0.7) 100%)",
          }}
        />
      </motion.div>

      {/* Foreground */}
      <motion.div
        style={reduce ? undefined : { y: textY }}
        className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-between px-6 pt-28 pb-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3"
        >
          <span className="h-2 w-2 rounded-full bg-white animate-pulse-dot" />
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/80">
            TwinLink · Cast a director. Make a film.
          </p>
        </motion.div>

        <div className="max-w-6xl">
          <h1 className="font-serif text-[13vw] leading-[0.9] tracking-tight md:text-[150px] lg:text-[180px]">
            <SplitHeading text="Direct" />
            <br />
            <span className="italic text-white/70">
              <SplitHeading text="cinema." delay={0.1} />
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 max-w-xl font-serif text-[17px] leading-relaxed text-white/80"
          >
            TwinLink is a creative studio behind a new generation of mini-films and
            commercials. Cast a fictional auteur, brief them, and direct frame by
            frame — Cannes-tier craft, without the agency.
          </motion.p>
        </div>

        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-3"
          >
            <Magnetic strength={0.3}>
              <Link
                href="/login"
                data-cursor="hover"
                className="group inline-flex h-14 cursor-pointer items-center gap-3 bg-white px-7 font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-900 transition-colors hover:bg-neutral-200"
              >
                Sign in
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <Magnetic strength={0.3}>
              <a
                href="#reel"
                data-cursor="hover"
                className="group inline-flex h-14 items-center gap-3 border border-white/30 px-7 font-mono text-[11px] uppercase tracking-[0.22em] text-white/90 transition-colors hover:border-white hover:text-white"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Watch the reel
              </a>
            </Magnetic>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="hidden md:block"
          >
            <ScrollBadge size={124} />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

/* =========================================================================
   KEYWORD MARQUEE
   ========================================================================= */
function KeywordMarquee() {
  const words = ["Cast", "Treat", "Compose", "Direct", "Cut", "Deliver"];
  return (
    <section className="border-b border-neutral-200 bg-white py-10">
      <Marquee speed={45}>
        {words.map((w, i) => (
          <span key={`${w}-${i}`} className="flex items-center">
            <span className="px-10 font-serif text-[52px] tracking-tight text-neutral-900 md:text-[84px]">
              {w}
            </span>
            <span className="text-[24px] text-neutral-300">✦</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* =========================================================================
   MANIFESTO
   ========================================================================= */
function ManifestoSection() {
  return (
    <section id="manifesto" className="relative bg-white py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-500">
            [01] Manifesto
          </p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-7">
            <h2 className="font-serif text-[40px] leading-[1.05] tracking-tight text-neutral-900 md:text-[72px]">
              <SplitHeading text="We don't generate clips." />
              <br />
              <span className="italic text-neutral-400">
                <SplitHeading text="We direct films." delay={0.1} />
              </span>
            </h2>
          </div>
          <div className="md:col-span-5 md:pt-6">
            <Stagger className="space-y-6">
              <StaggerItem>
                <p className="font-serif text-[17px] leading-[1.7] text-neutral-700">
                  Most AI tools type a prompt and pray. We treat every film like a shoot —
                  with a director on call, a treatment, a cast, blocked scenes, composed
                  frames, and a color script. Craft, not slot-machine.
                </p>
              </StaggerItem>
              <StaggerItem>
                <p className="font-serif text-[17px] leading-[1.7] text-neutral-700">
                  Cast a fictional auteur. Lock identity once, reuse forever. Your cast,
                  your locations, your brand — engineered as plates that never drift.
                  Approve each stage. Ship when it&apos;s yours.
                </p>
              </StaggerItem>
              <StaggerItem>
                <div className="pt-4">
                  <a
                    href="#method"
                    className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-900"
                  >
                    <span className="border-b border-neutral-900 pb-0.5">
                      Read the method
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </div>
              </StaggerItem>
            </Stagger>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mt-24 grid grid-cols-2 gap-y-10 border-t border-neutral-200 pt-12 md:grid-cols-4">
          {[
            { n: "20", label: "Directors to cast" },
            { n: "5", label: "Approval gates" },
            { n: "4K", label: "Master delivery" },
            { n: "48h", label: "Concept to cut" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <Counter
                value={s.n}
                className="block font-serif text-[44px] leading-none tracking-tight text-neutral-900 tabular-nums md:text-[64px]"
              />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                {s.label}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   CASTING — featured director personas
   ========================================================================= */
function CastingSection() {
  return (
    <section id="cast" className="border-y border-neutral-200 bg-neutral-50 py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-500">
                [02] The lobby
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 font-serif text-[44px] leading-[1.02] tracking-tight text-neutral-900 md:text-[88px]">
                Cast your director.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-sm font-serif text-[15px] leading-relaxed text-neutral-600">
              Twenty fictional auteurs. Each one a school of cinema, a voice, a list of
              films cited. Pick one to lead. Pick a second if you want a co-director —
              they&apos;ll argue.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {FEATURED_DIRECTORS.map((d, i) => (
            <motion.figure
              key={d.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
              className="group relative aspect-[3/4] overflow-hidden bg-neutral-900"
            >
              <Image
                src={`/directors/${d.id}.png`}
                alt={d.name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover grayscale transition-transform duration-[1400ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-105"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.75) 100%)",
                }}
              />
              <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/80">
                  Director
                </span>
                <span className="font-mono text-[10px] tabular-nums text-white/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <figcaption className="absolute inset-x-4 bottom-4 text-white">
                <p className="font-serif text-[20px] leading-tight tracking-tight">
                  {d.name}
                </p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-white/70">
                  {d.school}
                </p>
              </figcaption>
            </motion.figure>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-14 flex items-center justify-between border-t border-neutral-200 pt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              + 12 more in the lobby
            </p>
            <Link
              href="/login"
              className="group inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-900"
            >
              <span className="border-b border-neutral-900 pb-0.5">
                Sign in to cast
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* =========================================================================
   REEL — featured films (real assets)
   ========================================================================= */
function ReelSection() {
  // Span layout — varied mosaic across 6 cols.
  const spans = [
    "md:col-span-6",
    "md:col-span-3",
    "md:col-span-3",
    "md:col-span-6",
  ];

  return (
    <section id="reel" className="bg-white py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-500">
                [03] Selected films
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 font-serif text-[44px] leading-[1.02] tracking-tight text-neutral-900 md:text-[88px]">
                The reel.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-sm font-serif text-[15px] leading-relaxed text-neutral-600">
              Four films, looping in muted black-and-white below.{" "}
              <em>Grizzlies</em>, <em>Dream Big</em>, <em>Garage Pizza</em>,{" "}
              <em>Now on Android</em> — each composed, directed and rendered
              through the TwinLink pipeline.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-6 md:gap-5">
          {A.films.map((f, i) => (
            <div key={f.title} className={spans[i] ?? "md:col-span-3"}>
              <FilmTile
                index={i}
                src={f.src}
                label={f.label}
                title={f.title}
                meta={f.meta}
                aspect={f.aspect}
              />
            </div>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-14 flex justify-center">
            <a
              href="#method"
              className="group inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-900"
            >
              <span className="h-px w-10 bg-neutral-900 transition-all group-hover:w-16" />
              See how it&apos;s made
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* =========================================================================
   METHOD — 5 stages, numbered, media-rich
   ========================================================================= */
function MethodSection() {
  const stages = [
    {
      n: "01",
      label: "Casting",
      hint: "Lobby · lead · co-director",
      image: "/method/01-casting.png",
      desc:
        "Pick one director or two. Each is a fictional auteur with a school and a body of cinema cited. They stay with you from pitch to wrap.",
    },
    {
      n: "02",
      label: "Treatment",
      hint: "Concept · world · color · camera",
      image: "/method/02-treatment.png",
      desc:
        "You describe the image you can't stop seeing. Your director returns a treatment — one location, one color script, one camera language. Approve it, or push back.",
    },
    {
      n: "03",
      label: "Plates",
      hint: "Characters · locations · wardrobe · props",
      image: "/method/03-plates.png",
      desc:
        "Identity-locked references, generated once and reused everywhere. Multi-angle character sheets, location masters, wardrobe, props — composited into stills before any motion is wished for.",
    },
    {
      n: "04",
      label: "Keyframes",
      hint: "One composed still per shot",
      image: "/method/04-keyframes.png",
      desc:
        "Every shot becomes a composed still — framing, pose, lens, lighting, depth. Cannes-tier is decided here, not in the prompt. Edit, re-light, swap wardrobe — without losing what you already approved.",
    },
    {
      n: "05",
      label: "The Cut",
      hint: "Direct · score · grade · master",
      image: "/method/05-the-cut.png",
      desc:
        "Each frame becomes a directed shot. Cut, scored, grain pass, LUT, letterbox. Mastered at 4K, exported in any aspect — vertical for stories, anamorphic for the festival, square for the feed.",
    },
  ];

  return (
    <section id="method" className="bg-white py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-500">
            [04] The method
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-4 font-serif text-[44px] leading-[1.02] tracking-tight text-neutral-900 md:text-[88px]">
            Five stages.
            <br />
            <span className="italic text-neutral-400">Five approvals.</span>
          </h2>
        </Reveal>

        <div className="mt-20 space-y-16 md:space-y-24">
          {stages.map((s, i) => (
            <StageRow key={s.n} stage={s} flip={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StageRow({
  stage,
  flip,
}: {
  stage: { n: string; label: string; hint: string; desc: string; image?: string };
  flip: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="grid grid-cols-1 items-center gap-10 md:grid-cols-12"
    >
      {/* Image card with stage-number overlay */}
      <div className={`md:col-span-5 ${flip ? "md:order-2" : ""}`}>
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-900 text-white">
          {/* Gradient fallback (visible until the image loads or if missing) */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.08), transparent 55%), linear-gradient(180deg, #141414 0%, #000 100%)",
            }}
          />
          {stage.image && (
            // Plain <img> on purpose — next/image throws on a missing file
            // during dev, but during the bake we WANT a silent 404 → gradient
            // fallback so the page stays usable while assets are still generating.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stage.image}
              alt={`${stage.label} — TwinLink stage`}
              className="absolute inset-0 h-full w-full object-cover grayscale"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          {/* Darken so overlay text holds */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.45)" }}
          />
          {/* Vignette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 40%, transparent 50%, rgba(0,0,0,0.55) 100%)",
            }}
          />

          <div className="relative flex h-full flex-col justify-between p-6 md:p-8">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/70">
                Stage
              </span>
              <span className="font-mono text-[10px] tabular-nums text-white/70">
                {stage.n}/05
              </span>
            </div>

            <div className="relative -mx-2 flex items-center justify-center overflow-hidden">
              <motion.span
                initial={{ y: 60, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                className="font-serif text-[28vw] leading-[0.85] tracking-tighter text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] md:text-[220px]"
              >
                {stage.n}
              </motion.span>
            </div>

            <div className="flex items-end justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/80">
                {stage.label}
              </span>
              <div className="h-px w-16 bg-white/40" />
            </div>
          </div>
        </div>
      </div>

      {/* Copy */}
      <div className={`md:col-span-7 ${flip ? "md:order-1 md:pr-10" : "md:pl-10"}`}>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-400">
          {stage.hint}
        </p>
        <h3 className="mt-4 font-serif text-[36px] leading-[1.05] tracking-tight text-neutral-900 md:text-[56px]">
          {stage.label}
        </h3>
        <p className="mt-6 max-w-xl font-serif text-[17px] leading-[1.7] text-neutral-700">
          {stage.desc}
        </p>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   SPLIT FEATURE — video left / copy right, cinematic
   ========================================================================= */
function SplitFeatureSection() {
  return (
    <section className="relative bg-neutral-950 py-28 text-white md:py-40">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-7">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative aspect-[4/3] w-full overflow-hidden bg-black"
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.08), transparent 55%), linear-gradient(180deg, #141414 0%, #000 100%)",
              }}
            />
            <video
              src={A.split}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover grayscale"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 50% 40%, transparent 45%, rgba(0,0,0,0.6) 100%)",
              }}
            />
            <div className="absolute left-5 top-5 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-dot" />
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/70">
                Live on set
              </span>
            </div>
            <div className="absolute right-5 top-5 font-mono text-[10px] tabular-nums text-white/60">
              REC · 00:00:42:16
            </div>
          </motion.div>
        </div>

        <div className="md:col-span-5 md:self-center">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/50">
              [05] The director on call
            </p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-serif text-[40px] leading-[1.05] tracking-tight md:text-[64px]">
              A studio in a browser tab.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md font-serif text-[16px] leading-[1.7] text-white/70">
              Your director writes the treatment, locks the cast, composes every
              keyframe and shoots 25-second scenes with native sound. Casting,
              treatment, scenes, cut, 4K master — one workspace, no plugins, no exports.
            </p>
          </Reveal>
          <Stagger className="mt-10 space-y-4">
            {[
              "Realtime AI director with voice and face",
              "Identity-locked plates that never drift",
              "Composed keyframes before any motion",
              "Lineage graph — every edit traceable",
              "4K master, multi-aspect export",
            ].map((f) => (
              <StaggerItem key={f}>
                <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                  <span className="font-mono text-[10px] tabular-nums text-white/40">
                    ✦
                  </span>
                  <p className="font-serif text-[16px] text-white/90">{f}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.15}>
            <Magnetic strength={0.25}>
              <Link
                href="/login"
                data-cursor="hover"
                className="mt-12 inline-flex h-12 cursor-pointer items-center gap-3 bg-white px-6 font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-900 transition-colors hover:bg-neutral-200"
              >
                Sign in <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   DISCIPLINES MARQUEE
   ========================================================================= */
function DisciplinesMarquee() {
  const tags = [
    "Fashion",
    "Fragrance",
    "Automotive",
    "Hospitality",
    "Spirits",
    "Beauty",
    "Jewelry",
    "Tech",
    "Food",
    "Travel",
    "Music",
    "Editorial",
  ];
  return (
    <section className="border-y border-neutral-200 bg-white py-20">
      <div className="mx-auto mb-10 max-w-7xl px-6">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-500">
            [06] Built for every category
          </p>
        </Reveal>
      </div>
      <Marquee speed={60}>
        {tags.map((t, i) => (
          <span key={`${t}-${i}`} className="flex items-center">
            <span className="px-8 font-serif text-[56px] italic tracking-tight text-neutral-900 md:text-[96px]">
              {t}
            </span>
            <span className="font-serif text-[40px] text-neutral-300 md:text-[56px]">
              /
            </span>
          </span>
        ))}
      </Marquee>
      <Marquee speed={80} reverse>
        {tags.slice().reverse().map((t, i) => (
          <span key={`${t}-r-${i}`} className="flex items-center">
            <span className="px-8 font-mono text-[14px] uppercase tracking-[0.28em] text-neutral-500 md:text-[16px]">
              {t}
            </span>
            <span className="text-neutral-300">●</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* =========================================================================
   QUOTE — director-persona pullquote (from /lib/directors/personas/yuki-sato.json)
   ========================================================================= */
function QuoteSection() {
  return (
    <section className="bg-white py-32 md:py-44">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-500">
            [07] From the lobby
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <blockquote className="mt-10 font-serif text-[36px] leading-[1.1] tracking-tight text-neutral-900 md:text-[64px]">
            <span className="text-neutral-300">&ldquo;</span>
            Composition is character. Where the camera sits decides what the
            audience feels. Hold longer than feels comfortable. Then hold
            longer than that.
            <span className="text-neutral-300">&rdquo;</span>
          </blockquote>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="mt-14 flex items-center gap-4 border-t border-neutral-200 pt-6">
            <div className="relative h-12 w-12 overflow-hidden rounded-full bg-neutral-900">
              <Image
                src="/directors/yuki-sato.png"
                alt="Yuki Sato"
                fill
                sizes="48px"
                className="object-cover grayscale"
              />
            </div>
            <div>
              <p className="font-serif text-[16px] text-neutral-900">Yuki Sato</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                Director · Hong Kong romantic atmospherics
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* =========================================================================
   PRICING
   ========================================================================= */
function PricingSection() {
  const plans = [
    {
      name: "Opening",
      price: "$29",
      hint: "For the first film",
      bullets: [
        "200 credits / month",
        "Up to 1 film, 60 seconds",
        "All aspects, 1080p master",
        "Email support",
      ],
      cta: "Request access",
      featured: false,
    },
    {
      name: "Director",
      price: "$119",
      hint: "For working creatives",
      bullets: [
        "1,000 credits / month",
        "Unlimited films up to 90s",
        "4K master · priority render",
        "Early access to new craft",
      ],
      cta: "Request access",
      featured: true,
    },
    {
      name: "Studio",
      price: "Custom",
      hint: "For brands & agencies",
      bullets: [
        "Unlimited render · team seats",
        "Brand-locked plate library",
        "Dedicated creative engineer",
        "SLA, SSO, invoice billing",
      ],
      cta: "Talk to us",
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="border-t border-neutral-200 bg-white py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-500">
                [08] Pricing
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 font-serif text-[44px] leading-[1.02] tracking-tight text-neutral-900 md:text-[88px]">
                Pay per film.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-sm font-serif text-[15px] leading-relaxed text-neutral-600">
              Credits burn only when you generate. A 60-second film runs roughly 100
              credits end-to-end.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden border border-neutral-900 bg-neutral-900 md:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
              className={`flex flex-col p-10 ${
                p.featured
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-900"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <p
                  className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
                    p.featured ? "text-white/60" : "text-neutral-500"
                  }`}
                >
                  {p.name}
                </p>
                {p.featured && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/60">
                    ★ Popular
                  </span>
                )}
              </div>
              <p className="mt-6 font-serif text-[72px] leading-none tracking-tight tabular-nums">
                {p.price}
              </p>
              <p
                className={`mt-3 font-mono text-[10px] uppercase tracking-[0.22em] ${
                  p.featured ? "text-white/60" : "text-neutral-500"
                }`}
              >
                {p.hint}
              </p>

              <ul className="mt-10 flex-1 space-y-3">
                {p.bullets.map((b) => (
                  <li
                    key={b}
                    className={`flex gap-3 border-t pt-3 font-serif text-[14px] leading-relaxed ${
                      p.featured
                        ? "border-white/10 text-white/80"
                        : "border-neutral-200 text-neutral-700"
                    }`}
                  >
                    <span
                      className={`mt-[6px] h-1 w-3 flex-shrink-0 ${
                        p.featured ? "bg-white/50" : "bg-neutral-900"
                      }`}
                    />
                    {b}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={`mt-10 inline-flex h-12 cursor-pointer items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
                  p.featured
                    ? "bg-white text-neutral-900 hover:bg-neutral-200"
                    : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {p.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   CLOSING — full-bleed video with massive CTA
   ========================================================================= */
function ClosingSection() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.1, 1]);

  return (
    <section
      ref={ref}
      className="relative h-[90svh] min-h-[640px] w-full overflow-hidden bg-black text-white"
    >
      <motion.div
        style={reduce ? undefined : { y, scale }}
        className="absolute inset-0"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.08), transparent 55%), linear-gradient(180deg, #141414 0%, #000 100%)",
          }}
        />
        <video
          src={A.closing}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover grayscale"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.55)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 50%, transparent 40%, rgba(0,0,0,0.8) 100%)",
          }}
        />
      </motion.div>

      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-between px-6 py-16">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/70">
            [09] Start now
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/50">
            TwinLink · 2026
          </p>
        </div>

        <div className="max-w-5xl">
          <h2 className="font-serif text-[13vw] leading-[0.9] tracking-tight md:text-[140px]">
            <SplitHeading text="Your first" />
            <br />
            <span className="italic text-white/70">
              <SplitHeading text="film awaits." delay={0.1} />
            </span>
          </h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 max-w-lg font-serif text-[17px] leading-relaxed text-white/80"
          >
            TwinLink is invite-only while we onboard our first directors. Request access
            and we&apos;ll reach out within 72 hours. The benchmark is Cannes Lions — not
            engagement rate.
          </motion.p>
        </div>

        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-3"
          >
            <Magnetic strength={0.3}>
              <Link
                href="/login"
                data-cursor="hover"
                className="group inline-flex h-14 cursor-pointer items-center gap-3 bg-white px-8 font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-900 transition-colors hover:bg-neutral-200"
              >
                Sign in
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <Magnetic strength={0.3}>
              <a
                href="#reel"
                data-cursor="hover"
                className="inline-flex h-14 items-center gap-3 border border-white/30 px-8 font-mono text-[11px] uppercase tracking-[0.22em] text-white/90 transition-colors hover:border-white hover:text-white"
              >
                Watch the reel
              </a>
            </Magnetic>
          </motion.div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
            Invite-only · manual review · 72h reply
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   FOOTER
   ========================================================================= */
function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-12">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-serif text-[26px] tracking-tight text-neutral-900">
                TwinLink
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
                director · 2026
              </span>
            </Link>
            <p className="mt-6 max-w-sm font-serif text-[15px] leading-[1.7] text-neutral-600">
              A creative studio on demand. Cinema-grade commercials and mini-films,
              cast and directed frame by frame.
            </p>
          </div>

          <div className="md:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
              Studio
            </p>
            <ul className="mt-4 space-y-2 font-serif text-[15px] text-neutral-700">
              <li><a href="#cast" className="hover:text-neutral-900">Cast</a></li>
              <li><a href="#reel" className="hover:text-neutral-900">Reel</a></li>
              <li><a href="#method" className="hover:text-neutral-900">Method</a></li>
              <li><a href="#pricing" className="hover:text-neutral-900">Pricing</a></li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
              Company
            </p>
            <ul className="mt-4 space-y-2 font-serif text-[15px] text-neutral-700">
              <li><a href="#manifesto" className="hover:text-neutral-900">Manifesto</a></li>
              <li>
                <Link href="/login" className="hover:text-neutral-900">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
              Get started
            </p>
            <ul className="mt-4 space-y-2 font-serif text-[15px] text-neutral-700">
              <li>
                <Link href="/login" className="hover:text-neutral-900">
                  Sign in
                </Link>
              </li>
              <li>
                <a href="#reel" className="hover:text-neutral-900">
                  Watch the reel
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-20 flex flex-col items-start justify-between gap-4 border-t border-neutral-200 pt-8 md:flex-row md:items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
            © 2026 TwinLink Studio · All films reserved
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
            Invite-only · 72h reply
          </p>
        </div>
      </div>

      {/* Super-sized watermark */}
      <div className="overflow-hidden border-t border-neutral-200">
        <p className="select-none whitespace-nowrap text-center font-serif leading-none tracking-tighter text-neutral-900 text-[28vw] md:text-[24vw]">
          TwinLink
        </p>
      </div>
    </footer>
  );
}
