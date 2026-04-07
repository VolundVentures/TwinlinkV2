"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LandingNav } from "./components/landing-nav";
import {
  Reveal,
  StaggerReveal,
  StaggerItem,
  AnimatedCounter,
  Marquee,
  Float,
} from "./components/motion";
import {
  ImageIcon,
  VideoIcon,
  SearchIcon,
  ZapIcon,
  GlobeIcon,
  SparklesIcon,
  ArrowRight,
  CheckIcon,
  PlayIcon,
  LayoutGridIcon,
  BrainCircuitIcon,
  TrendingUpIcon,
  UsersIcon,
  BarChart3Icon,
  MousePointerClickIcon,
  ChevronDownIcon,
  MailIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

/* ═══════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════ */

const features = [
  {
    icon: BrainCircuitIcon,
    title: "AI Agent Workflow",
    description:
      "Chat with your creative agent. It researches, strategizes, generates, and iterates — all in real-time.",
    span: "md:col-span-2",
  },
  {
    icon: ImageIcon,
    title: "Static Ad Creatives",
    description:
      "9+ scroll-stopping ad variations per run. Each with creative rationale, multiple formats, and instant download.",
    span: "",
  },
  {
    icon: VideoIcon,
    title: "UGC Video Ads",
    description:
      "AI avatars deliver your script with realistic lip-sync in Arabic and English. Script to video in minutes.",
    span: "",
  },
  {
    icon: SearchIcon,
    title: "Competitor Intelligence",
    description:
      "Scrape Meta Ad Library and Google Ads. AI scores competitor creatives and surfaces winning patterns.",
    span: "",
  },
  {
    icon: ZapIcon,
    title: "Full Campaign Engine",
    description:
      "One prompt generates static + video + scripts + copy. Everything to launch across Meta, TikTok, and Snapchat.",
    span: "",
  },
  {
    icon: GlobeIcon,
    title: "Arabic Native",
    description:
      "Full RTL interface, Arabic-speaking AI avatars, MSA + dialect voices. Built for MENA from day one.",
    span: "md:col-span-2",
  },
];

const steps = [
  {
    number: "01",
    title: "Enter your brand URL",
    description:
      "AI scrapes your website and extracts brand identity — colors, products, voice, and audience — automatically.",
    icon: MousePointerClickIcon,
  },
  {
    number: "02",
    title: "Choose your task",
    description:
      "Static ads, UGC videos, competitor research, or full campaigns. Select and configure in seconds.",
    icon: LayoutGridIcon,
  },
  {
    number: "03",
    title: "Watch AI generate",
    description:
      "The agent streams its work in real-time. Research, creative strategy, image generation — visible step by step.",
    icon: SparklesIcon,
  },
  {
    number: "04",
    title: "Download & launch",
    description:
      "Preview in Feed, Reels, Story, and Display formats. Download and push to Meta, TikTok, or Snapchat.",
    icon: ArrowRight,
  },
];

const metrics = [
  { value: 10, suffix: "x", label: "Faster than agencies" },
  { value: 90, suffix: "%", label: "Cost reduction" },
  { value: 50, suffix: "K+", label: "Ads generated" },
  { value: 4.9, suffix: "/5", label: "User rating", decimals: 1 },
];

const testimonials = [
  {
    name: "Sarah M.",
    role: "Head of Growth",
    company: "D2C Brand",
    quote:
      "We replaced our creative agency entirely. 10x the output at a fraction of the cost. Our ROAS improved by 340% in the first month.",
    metric: "340% ROAS increase",
  },
  {
    name: "Ahmed K.",
    role: "Marketing Director",
    company: "Tech Startup",
    quote:
      "The Arabic-native support is a game changer. Finally an AI tool that understands MENA markets and produces creatives that actually resonate.",
    metric: "5x engagement in MENA",
  },
  {
    name: "Lisa R.",
    role: "Performance Marketer",
    company: "Growth Agency",
    quote:
      "From brand URL to launch-ready ads in under 2 minutes. My team can't believe it. We've scaled from 10 to 200 clients without hiring.",
    metric: "20x client capacity",
  },
  {
    name: "Omar S.",
    role: "Founder & CEO",
    company: "E-commerce",
    quote:
      "The competitor intelligence alone is worth the subscription. We spot winning ad patterns before our competition can react.",
    metric: "2 weeks ahead of market",
  },
];

const comparisons = [
  { feature: "Brand to ad creative", old: "3-5 days", new: "2 minutes" },
  { feature: "Cost per campaign", old: "$2,000-$10,000", new: "From $0" },
  { feature: "Ad variations", old: "3-5 per cycle", new: "9+ per run" },
  { feature: "Video ads with avatars", old: "Not available", new: "Included" },
  { feature: "Competitor research", old: "Manual, weekly", new: "AI-powered, instant" },
  { feature: "Arabic support", old: "Extra cost", new: "Native, built-in" },
];

const useCases = [
  {
    title: "E-commerce Brands",
    description: "Generate product ads, seasonal campaigns, and retargeting creatives at scale.",
    icon: BarChart3Icon,
    stats: "Average 4.2x ROAS improvement",
  },
  {
    title: "Marketing Agencies",
    description: "Scale your creative output without scaling your team. Serve more clients, faster.",
    icon: UsersIcon,
    stats: "Handle 10x more clients",
  },
  {
    title: "Startups & Apps",
    description: "Launch fast with AI-generated creatives. Test more, learn faster, grow quicker.",
    icon: TrendingUpIcon,
    stats: "60% faster time-to-market",
  },
  {
    title: "MENA Businesses",
    description: "Native Arabic support with cultural awareness. RTL layouts, local dialects, and relevant imagery.",
    icon: GlobeIcon,
    stats: "3x engagement vs translated ads",
  },
];

const integrations = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "Snapchat Ads",
  "Instagram",
  "YouTube",
  "LinkedIn",
  "X (Twitter)",
];

const faqItems = [
  {
    q: "How does TwinLink generate ads?",
    a: "TwinLink uses an AI agent workflow. You provide your brand URL, and our AI scrapes your website to understand your brand identity, products, and audience. It then generates strategic ad creatives with multiple variations, formats, and creative rationales — all in real-time.",
  },
  {
    q: "What types of ads can I create?",
    a: "Static image ads (feed, story, display formats), UGC-style video ads with AI avatars and lip-sync, and full campaign packages that include copy, scripts, images, and videos. All optimized for Meta, TikTok, Snapchat, and more.",
  },
  {
    q: "Is Arabic support truly native?",
    a: "Yes. TwinLink was built for MENA from day one. We support full RTL interfaces, MSA and dialect-specific Arabic voices, Arabic-speaking AI avatars, and culturally relevant creative generation. It's not a translation layer — it's native.",
  },
  {
    q: "How does competitor intelligence work?",
    a: "Our AI scrapes Meta Ad Library and Google Ads Transparency Center to find your competitors' active ads. It then scores and analyzes each creative, surfacing winning patterns, messaging strategies, and visual trends you can leverage.",
  },
  {
    q: "Can I use my own brand guidelines?",
    a: "Absolutely. While our AI can auto-extract brand identity from your URL, you can also upload brand guidelines, color palettes, fonts, and tone-of-voice documents. The AI respects your brand system across all generated creatives.",
  },
  {
    q: "What's the credit system?",
    a: "Credits are used for generation tasks. Static ads cost fewer credits, video ads cost more. Free plan includes 500 credits, Pro includes 5,000/month, and Enterprise is unlimited. Unused credits don't roll over.",
  },
];

const footerLinks = {
  Product: ["Features", "Pricing", "Use Cases", "Integrations", "Changelog"],
  Resources: ["Documentation", "API Reference", "Blog", "Help Center"],
  Company: ["About", "Careers", "Press", "Contact"],
  Legal: ["Privacy", "Terms", "Security"],
};

/* ═══════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black overflow-x-hidden">
      <LandingNav />

      <HeroSection />
      <LogoBar />
      <MetricsSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ComparisonSection />
      <UseCasesSection />
      <TestimonialsSection />
      <IntegrationsSection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════ */

function HeroSection() {
  return (
    <section className="relative flex min-h-[100vh] flex-col items-center justify-center px-6 pt-20 pb-0 overflow-hidden">
      {/* Grid pattern background */}
      <div className="landing-grid-bg absolute inset-0" />

      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[1000px] rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl text-center">
        {/* Headline */}
        <Reveal delay={0.05}>
          <h1 className="text-[3.5rem] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[5rem] lg:text-[6.5rem]">
            Create ads that
            <br />
            <span className="text-[#4F6247]">actually convert.</span>
          </h1>
        </Reveal>

        {/* Subtitle */}
        <Reveal delay={0.15}>
          <p className="mx-auto mt-8 max-w-2xl text-[18px] sm:text-[20px] leading-relaxed text-black/45">
            From brand URL to launch-ready static ads, UGC videos, and full
            campaigns in minutes. Your AI creative partner that 10x&apos;s your
            team&apos;s output.
          </p>
        </Reveal>

        {/* CTAs */}
        <Reveal delay={0.25}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2.5 rounded-full bg-[#4F6247] px-8 py-4 text-[15px] font-medium text-white shadow-lg transition-all hover:bg-[#3d4a3b] hover:shadow-xl"
              >
                Start creating for free
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </Link>
            <Link href="#how-it-works">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2.5 rounded-full border border-black/10 bg-white px-8 py-4 text-[15px] font-medium text-black/60 transition-colors hover:text-black hover:border-black/20"
              >
                <PlayIcon className="h-4 w-4" />
                See how it works
              </motion.button>
            </Link>
          </div>
        </Reveal>

        {/* Micro-copy */}
        <Reveal delay={0.35}>
          <p className="mt-5 text-[13px] text-black/25 tracking-wide">
            500 free credits &middot; No credit card required &middot; Setup in
            30 seconds
          </p>
        </Reveal>
      </div>

      {/* Preview window */}
      <Reveal delay={0.45} className="relative mt-16 w-full max-w-6xl mx-auto px-4">
        <div className="relative">
          {/* Glow behind the window */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-b from-black/[0.03] to-transparent blur-2xl"
          />

          {/* Browser window mockup */}
          <div className="relative rounded-2xl border border-black/[0.08] bg-white shadow-2xl overflow-hidden">
            {/* Title bar */}
            <div className="flex items-center gap-2 border-b border-black/[0.05] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-black/10" />
                <div className="h-3 w-3 rounded-full bg-black/10" />
                <div className="h-3 w-3 rounded-full bg-black/10" />
              </div>
              <div className="mx-auto flex items-center gap-2 rounded-lg bg-black/[0.03] px-4 py-1">
                <div className="h-3 w-3 rounded-sm bg-black/10" />
                <span className="text-[12px] text-black/30 font-medium">
                  app.twinlink.ai
                </span>
              </div>
              <div className="w-[52px]" />
            </div>

            {/* Content area */}
            <div className="relative aspect-[16/9] max-h-[500px] bg-gradient-to-br from-neutral-50 to-neutral-100 p-6 sm:p-10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
                {/* Sidebar */}
                <div className="hidden md:block md:col-span-3 space-y-3">
                  <div className="h-8 w-3/4 rounded-lg bg-black/[0.06]" />
                  <div className="space-y-2 mt-6">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-10 rounded-lg bg-black/[0.04]" />
                    ))}
                  </div>
                </div>

                {/* Main content */}
                <div className="md:col-span-6 space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 rounded-full bg-black/[0.08]" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-32 rounded bg-black/[0.1]" />
                      <div className="h-2 w-20 rounded bg-black/[0.05]" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-white border border-black/[0.06] p-4 shadow-sm max-w-[80%]">
                      <div className="space-y-2">
                        <div className="h-2.5 w-full rounded bg-black/[0.08]" />
                        <div className="h-2.5 w-3/4 rounded bg-black/[0.06]" />
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/[0.03] border border-black/[0.05] p-4 max-w-[85%] ml-auto">
                      <div className="space-y-2">
                        <div className="h-2.5 w-full rounded bg-black/[0.06]" />
                        <div className="h-2.5 w-2/3 rounded bg-black/[0.04]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right panel */}
                <div className="hidden md:block md:col-span-3 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-black/[0.07] mb-4" />
                  <Float amplitude={4} duration={5}>
                    <div className="aspect-[4/5] rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200 border border-black/[0.06] shadow-sm" />
                  </Float>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="aspect-square rounded-lg bg-black/[0.04]" />
                    <div className="aspect-square rounded-lg bg-black/[0.06]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Scroll indicator */}
      <Reveal delay={0.6}>
        <motion.div
          className="mt-12 mb-8 flex flex-col items-center gap-2"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-[11px] text-black/20 tracking-widest uppercase">
            Scroll
          </span>
          <ChevronDownIcon className="h-4 w-4 text-black/15" />
        </motion.div>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   LOGO BAR
   ═══════════════════════════════════════════════ */

function LogoBar() {
  const logos = [
    "Meta",
    "Google",
    "TikTok",
    "Snapchat",
    "Amazon",
    "Shopify",
    "Notion",
    "Linear",
    "Vercel",
    "Stripe",
  ];

  return (
    <section className="border-y border-black/[0.05] py-10">
      <Reveal>
        <p className="label-caps mb-8 text-center">
          Trusted by forward-thinking brands
        </p>
      </Reveal>
      <Marquee speed={25}>
        {logos.map((name) => (
          <span
            key={name}
            className="text-[15px] font-semibold tracking-[0.15em] text-black/[0.12] uppercase whitespace-nowrap select-none"
          >
            {name}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   METRICS
   ═══════════════════════════════════════════════ */

function MetricsSection() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <StaggerReveal className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {metrics.map((m) => (
            <StaggerItem key={m.label} className="text-center">
              <div className="text-[3rem] sm:text-[4rem] font-bold tracking-[-0.04em] leading-none">
                <AnimatedCounter
                  to={m.value}
                  suffix={m.suffix}
                  decimals={m.decimals ?? 0}
                />
              </div>
              <p className="mt-2 text-[14px] text-black/40">{m.label}</p>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   FEATURES — Bento Grid
   ═══════════════════════════════════════════════ */

function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative overflow-hidden bg-[#0A0A0A] px-6 py-28 text-white"
    >
      <div className="landing-dot-bg absolute inset-0 opacity-[0.15]" />

      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-16 text-center">
            <p className="label-caps mb-4 text-white/25">Platform</p>
            <h2 className="text-[2.5rem] font-bold tracking-[-0.03em] sm:text-[3.5rem] lg:text-[4rem] leading-[1.05]">
              Everything you need to
              <br />
              <span className="text-white/30">create winning ads</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-white/35">
              One AI platform replaces your entire creative stack. Research,
              strategy, generation, and optimization — unified.
            </p>
          </div>
        </Reveal>

        <StaggerReveal className="grid gap-4 md:grid-cols-4" stagger={0.06}>
          {features.map((feature) => (
            <StaggerItem key={feature.title} className={feature.span}>
              <motion.div
                whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.15)" }}
                transition={{ duration: 0.2 }}
                className="group relative h-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 transition-colors"
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.04) 0%, transparent 60%)",
                  }}
                />
                <div className="relative">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#4F6247]/20 border border-[#4F6247]/10">
                    <feature.icon className="h-5 w-5 text-[#8BA686]" />
                  </div>
                  <h3 className="text-[16px] font-semibold tracking-tight text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-white/30">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════ */

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="px-6 py-28">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="mb-16 text-center">
            <p className="label-caps mb-4">Process</p>
            <h2 className="text-[2.5rem] font-bold tracking-[-0.03em] sm:text-[3.5rem] leading-[1.05]">
              Brand URL to launch
              <br />
              <span className="text-black/25">in four steps</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-black/40">
              A workflow so streamlined it feels like magic. Your AI agent
              handles every step.
            </p>
          </div>
        </Reveal>

        <div className="relative">
          <div className="absolute left-[27px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-black/[0.08] to-transparent hidden sm:block" />

          <div className="space-y-5">
            {steps.map((step, i) => (
              <Reveal key={step.number} delay={i * 0.1}>
                <motion.div
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                  className="group relative flex gap-6 rounded-2xl border border-black/[0.06] bg-white p-6 sm:p-8 transition-all hover:border-black/[0.12] hover:shadow-lg"
                >
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#4F6247] text-white">
                    <step.icon className="h-5 w-5" />
                    <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#4F6247]/15 text-[11px] font-bold text-[#4F6247]">
                      {step.number}
                    </div>
                  </div>

                  <div className="pt-1">
                    <h3 className="text-[17px] font-semibold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-black/40">
                      {step.description}
                    </p>
                  </div>

                  <ArrowRight className="hidden sm:block h-5 w-5 shrink-0 text-black/10 group-hover:text-black/30 transition-colors self-center ml-auto" />
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   COMPARISON TABLE
   ═══════════════════════════════════════════════ */

function ComparisonSection() {
  return (
    <section className="px-6 py-28 bg-neutral-50/50">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="mb-16 text-center">
            <p className="label-caps mb-4">Comparison</p>
            <h2 className="text-[2.5rem] font-bold tracking-[-0.03em] sm:text-[3.5rem] leading-[1.05]">
              The old way is
              <br />
              <span className="text-black/25">expensive and slow</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-black/40">
              See how TwinLink compares to traditional creative agencies and
              in-house teams.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden shadow-sm">
            <div className="grid grid-cols-3 border-b border-black/[0.06] bg-black/[0.02]">
              <div className="p-5 text-[13px] font-medium text-black/40">
                Feature
              </div>
              <div className="p-5 text-[13px] font-medium text-black/30 text-center">
                Traditional Agency
              </div>
              <div className="p-5 text-[13px] font-bold text-black text-center">
                TwinLink AI
              </div>
            </div>

            {comparisons.map((row, i) => (
              <motion.div
                key={row.feature}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="grid grid-cols-3 border-b border-black/[0.04] last:border-0 hover:bg-black/[0.01] transition-colors"
              >
                <div className="p-5 text-[14px] font-medium text-black/70">
                  {row.feature}
                </div>
                <div className="p-5 text-[14px] text-black/30 text-center">
                  {row.old}
                </div>
                <div className="p-5 text-[14px] font-semibold text-[#4F6247] text-center">
                  {row.new}
                </div>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   USE CASES
   ═══════════════════════════════════════════════ */

function UseCasesSection() {
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-16 text-center">
            <p className="label-caps mb-4">Use Cases</p>
            <h2 className="text-[2.5rem] font-bold tracking-[-0.03em] sm:text-[3.5rem] leading-[1.05]">
              Built for teams
              <br />
              <span className="text-black/25">that move fast</span>
            </h2>
          </div>
        </Reveal>

        <StaggerReveal className="grid gap-5 sm:grid-cols-2" stagger={0.08}>
          {useCases.map((uc) => (
            <StaggerItem key={uc.title}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="group relative rounded-2xl border border-black/[0.06] bg-white p-8 transition-all hover:border-black/[0.12] hover:shadow-lg h-full"
              >
                <div className="flex items-start gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#4F6247]/[0.06] border border-[#4F6247]/[0.1]">
                    <uc.icon className="h-5 w-5 text-[#4F6247]" />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-tight">
                      {uc.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-black/40">
                      {uc.description}
                    </p>
                    <p className="mt-4 text-[13px] font-semibold text-black/60">
                      {uc.stats}
                    </p>
                  </div>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════════ */

function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden bg-[#0A0A0A] px-6 py-28 text-white">
      <div className="landing-dot-bg absolute inset-0 opacity-[0.1]" />

      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-16 text-center">
            <p className="label-caps mb-4 text-white/25">Testimonials</p>
            <h2 className="text-[2.5rem] font-bold tracking-[-0.03em] sm:text-[3.5rem] leading-[1.05]">
              Loved by marketers
              <br />
              <span className="text-white/25">everywhere</span>
            </h2>
          </div>
        </Reveal>

        <StaggerReveal className="grid gap-5 sm:grid-cols-2" stagger={0.08}>
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 h-full transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]">
                <div className="mb-5 inline-flex rounded-full bg-[#4F6247]/20 border border-[#4F6247]/15 px-3 py-1 text-[12px] font-semibold text-[#8BA686]">
                  {t.metric}
                </div>

                <p className="text-[15px] leading-relaxed text-white/50">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="mt-6 flex items-center gap-3 pt-5 border-t border-white/[0.06]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-[13px] font-bold text-white/50">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-white/80">
                      {t.name}
                    </p>
                    <p className="text-[12px] text-white/30">
                      {t.role}, {t.company}
                    </p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   INTEGRATIONS
   ═══════════════════════════════════════════════ */

function IntegrationsSection() {
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <p className="label-caps mb-4">Integrations</p>
          <h2 className="text-[2.5rem] font-bold tracking-[-0.03em] sm:text-[3.5rem] leading-[1.05]">
            Publish everywhere
            <br />
            <span className="text-black/25">from one platform</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-black/40">
            Generate creatives optimized for every major ad platform. Export in
            the right formats, sizes, and specs — automatically.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-4">
            {integrations.map((name) => (
              <motion.div
                key={name}
                whileHover={{ y: -3, borderColor: "rgba(0,0,0,0.15)" }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 rounded-xl border border-black/[0.07] bg-white px-6 py-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="h-6 w-6 rounded-md bg-black/[0.06]" />
                <span className="text-[14px] font-medium text-black/60">
                  {name}
                </span>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   PRICING
   ═══════════════════════════════════════════════ */

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "500 credits to get started",
    features: [
      "500 free credits",
      "Static ad generation",
      "1 brand",
      "Community support",
    ],
    cta: "Get started",
    popular: false,
    dark: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "5,000 credits/month",
    features: [
      "5,000 credits/month",
      "Static + Video ads",
      "UGC avatars",
      "5 brands",
      "Competitor research",
      "Priority support",
    ],
    cta: "Start free trial",
    popular: true,
    dark: true,
  },
  {
    name: "Enterprise",
    price: "$79",
    period: "/month",
    description: "Unlimited credits",
    features: [
      "Unlimited credits",
      "All generation types",
      "Custom avatars",
      "Unlimited brands",
      "API access",
      "White-label option",
      "Dedicated support",
    ],
    cta: "Contact sales",
    popular: false,
    dark: false,
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="px-6 py-28 bg-neutral-50/50">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="mb-16 text-center">
            <p className="label-caps mb-4">Pricing</p>
            <h2 className="text-[2.5rem] font-bold tracking-[-0.03em] sm:text-[3.5rem] leading-[1.05]">
              Start free,
              <br />
              <span className="text-black/25">scale as you grow</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-black/40">
              No hidden fees, no surprises. Every plan includes full access to
              the AI agent.
            </p>
          </div>
        </Reveal>

        <StaggerReveal className="grid gap-6 md:grid-cols-3" stagger={0.1}>
          {plans.map((plan) => (
            <StaggerItem key={plan.name}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className={`relative flex flex-col rounded-2xl p-8 h-full transition-shadow hover:shadow-xl ${
                  plan.dark
                    ? "bg-[#4F6247] text-white border-2 border-[#4F6247] shadow-xl"
                    : "bg-white border border-black/[0.08]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-[11px] font-bold tracking-wide text-[#4F6247] shadow-sm border border-[#4F6247]/15">
                    Most Popular
                  </div>
                )}

                <div>
                  <h3
                    className={`text-[15px] font-semibold tracking-tight ${
                      plan.dark ? "text-white/70" : ""
                    }`}
                  >
                    {plan.name}
                  </h3>
                  <div className="mt-5">
                    <span className="text-[3rem] font-bold tracking-tight leading-none">
                      {plan.price}
                    </span>
                    <span
                      className={`ml-1 text-sm ${
                        plan.dark ? "text-white/35" : "text-black/35"
                      }`}
                    >
                      {plan.period}
                    </span>
                  </div>
                  <p
                    className={`mt-2 text-[13px] ${
                      plan.dark ? "text-white/40" : "text-black/40"
                    }`}
                  >
                    {plan.description}
                  </p>
                  <ul className="mt-7 space-y-3">
                    {plan.features.map((item) => (
                      <li
                        key={item}
                        className={`flex items-center gap-2.5 text-[13px] ${
                          plan.dark ? "text-white/60" : "text-black/55"
                        }`}
                      >
                        <CheckIcon
                          className={`h-3.5 w-3.5 shrink-0 ${
                            plan.dark ? "text-white/40" : "text-black/25"
                          }`}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-8">
                  <Link href="/signup" className="block">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full rounded-full py-3 text-[14px] font-medium transition-colors ${
                        plan.dark
                          ? "bg-white text-[#4F6247] hover:bg-white/90"
                          : "border border-black/10 hover:bg-[#4F6247] hover:text-white hover:border-[#4F6247]"
                      }`}
                    >
                      {plan.cta}
                    </motion.button>
                  </Link>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════════ */

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      className="border-b border-black/[0.06] last:border-0"
      initial={false}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left group"
      >
        <span className="text-[15px] font-medium text-black/80 group-hover:text-black transition-colors pr-8">
          {q}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-black/25" />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: open ? "auto" : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-[14px] leading-relaxed text-black/40 pr-8">
          {a}
        </p>
      </motion.div>
    </motion.div>
  );
}

function FAQSection() {
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="label-caps mb-4">FAQ</p>
            <h2 className="text-[2.5rem] font-bold tracking-[-0.03em] sm:text-[3.5rem] leading-[1.05]">
              Questions?
              <br />
              <span className="text-black/25">We have answers.</span>
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-black/[0.08] bg-white px-7">
            {faqItems.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mt-8 text-center text-[14px] text-black/35">
            Still have questions?{" "}
            <Link
              href="mailto:support@twinlink.ai"
              className="text-black/60 underline underline-offset-2 hover:text-black transition-colors"
            >
              Reach out to our team
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   FINAL CTA
   ═══════════════════════════════════════════════ */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#0A0A0A] px-6 py-32 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="label-caps mb-5 text-white/20">Get started</p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-[2.5rem] font-bold tracking-[-0.03em] sm:text-[4rem] leading-[1.05]">
            Ready to 10x your
            <br />
            <span className="text-white/30">creative output?</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-white/35">
            Join thousands of marketers using AI to create better ads, faster.
            Your first 500 credits are on us.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2.5 rounded-full bg-[#4F6247] px-8 py-4 text-[15px] font-medium text-white shadow-lg transition-all hover:bg-[#3d4a3b] hover:shadow-xl"
              >
                Start creating for free
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </Link>
            <Link href="#pricing">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-8 py-4 text-[15px] font-medium text-white/50 transition-colors hover:border-white/20 hover:text-white/70"
              >
                View pricing
              </motion.button>
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.4}>
          <p className="mt-6 text-[13px] text-white/15 tracking-wide">
            No credit card required &middot; Cancel anytime &middot; Setup in 30
            seconds
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-black/[0.05] px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-6">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="TwinLink" className="h-8 w-8" />
              <span className="text-[18px] font-bold tracking-tight">
                TwinLink
              </span>
            </div>
            <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-black/35">
              AI-powered ad generation platform. From brand URL to
              launch-ready creatives in minutes.
            </p>
            <div className="mt-6 flex gap-3">
              {[XIcon, MailIcon].map((Icon, i) => (
                <div
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.06] text-black/30 hover:text-black/60 hover:border-black/15 transition-colors cursor-pointer"
                >
                  <Icon className="h-4 w-4" />
                </div>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-[12px] font-semibold tracking-wide uppercase text-black/30 mb-4">
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <span className="text-[14px] text-black/40 hover:text-black transition-colors cursor-pointer">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-black/[0.05] pt-8 sm:flex-row">
          <p className="text-[13px] text-black/25">
            &copy; {new Date().getFullYear()} TwinLink. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms of Service", "Cookies"].map((item) => (
              <span
                key={item}
                className="text-[13px] text-black/25 hover:text-black/50 transition-colors cursor-pointer"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
