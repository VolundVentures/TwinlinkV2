"use client";

// First-run post-signup landing — the user just made an account and lands here
// before ever seeing the dashboard. Pitches AUTEUR (cast → pitch → world → cut
// → premiere), not the legacy "5-stage pipeline of plates and shots" frame,
// because the cinema-school + live-director angle is what makes the product
// different. Editorial B&W to match the rest of the studio surface.

import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Film } from "lucide-react";

const FEATURED_DIRECTORS = [
  {
    id: "yuki-sato",
    name: "Yuki Sato",
    school: "Hong Kong romantic atmospherics",
    portraitUrl: "/directors/yuki-sato.png",
  },
  {
    id: "marcel-vrai",
    name: "Marcel Vraí",
    school: "American crime maximalism",
    portraitUrl: "/directors/marcel-vrai.png",
  },
  {
    id: "aleksandra-volkov",
    name: "Aleksandra Volkov",
    school: "Soviet long-take poetics",
    portraitUrl: "/directors/aleksandra-volkov.png",
  },
  {
    id: "edgar-loomis",
    name: "Edgar Loomis",
    school: "Symmetry & deadpan",
    portraitUrl: "/directors/edgar-loomis.png",
  },
];

const ROOMS = [
  {
    n: "01",
    label: "Cast",
    hint: "Pick one or two of twenty fictional auteurs. They direct with you live.",
    image: "/method/01-casting.png",
  },
  {
    n: "02",
    label: "Treatment",
    hint: "Tell them the story. They write the treatment with you.",
    image: "/method/02-treatment.png",
  },
  {
    n: "03",
    label: "Plates",
    hint: "Characters, locations, props — composed under their visual signature.",
    image: "/method/03-plates.png",
  },
  {
    n: "04",
    label: "Keyframes",
    hint: "Every shot's first frame, framed and lit to their school.",
    image: "/method/04-keyframes.png",
  },
  {
    n: "05",
    label: "Cut",
    hint: "Coverage, signature passes, score, voiceover, ambient bed.",
    image: "/method/05-the-cut.png",
  },
];

export function OnboardingWizard({ orgId, userId }: { orgId: string; userId: string }) {
  const router = useRouter();
  const orgTag = orgId.slice(0, 8);
  const userTag = userId.slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-6xl px-10 py-14 space-y-20">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section>
        <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-neutral-500">
          Welcome to TwinLink · AUTEUR
        </p>
        <h1 className="mt-6 font-serif text-[72px] leading-[0.98] tracking-tight text-neutral-900">
          You don&apos;t generate.
          <br />
          You direct.
        </h1>
        <p className="mt-8 max-w-2xl font-serif text-[19px] leading-[1.7] text-neutral-700">
          AUTEUR is a virtual film studio. Cast a fictional auteur — twenty schools of
          cinema, twenty voices — and they co-direct your film with you in real time.
          From the pitch to the premiere, their craft is in every frame, and every
          decision becomes a lesson you keep.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/director")}
            className="group inline-flex h-12 items-center gap-3 bg-neutral-900 px-7 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-neutral-800"
          >
            Start your first film
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            onClick={() => router.push("/dashboard/generations")}
            className="inline-flex h-12 items-center gap-3 border border-neutral-300 px-7 font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
          >
            <Film className="h-3.5 w-3.5" />
            Browse the reel
          </button>
        </div>
      </section>

      {/* ── Featured directors ─────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 pt-12">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-neutral-500">
              The cast · 20 directors
            </p>
            <p className="mt-3 max-w-xl font-serif text-[16px] leading-relaxed text-neutral-600">
              Each is fictional — but trained on a real auteur&apos;s body of work. Their
              voice, taste, references, and signature grade travel with you through the
              production.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/director")}
            className="group hidden md:inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-900"
          >
            <span className="border-b border-neutral-900 pb-0.5">See all 20</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        </div>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-5">
          {FEATURED_DIRECTORS.map((d) => (
            <button
              key={d.id}
              onClick={() => router.push("/dashboard/director")}
              className="group block text-left"
            >
              <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.portraitUrl}
                  alt={d.name}
                  className="h-full w-full object-cover grayscale transition-transform duration-500 group-hover:scale-[1.03] group-hover:grayscale-0"
                />
              </div>
              <p className="mt-3 font-serif text-[17px] text-neutral-900">{d.name}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                {d.school}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Five rooms ─────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 pt-12">
        <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-neutral-500">
          The five rooms
        </p>
        <p className="mt-3 max-w-2xl font-serif text-[16px] leading-relaxed text-neutral-600">
          You move through five rooms. Each ends in an approval gate — nothing ships
          unless you bless it. The director walks alongside you the whole time.
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {ROOMS.map((r) => (
            <div key={r.n} className="space-y-3">
              <div className="aspect-[4/5] overflow-hidden bg-neutral-100 border-t border-neutral-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image}
                  alt={r.label}
                  className="h-full w-full object-cover grayscale"
                />
              </div>
              <div>
                <p className="font-mono text-[11px] tabular-nums text-neutral-500">
                  {r.n}
                </p>
                <p className="mt-0.5 font-serif text-[18px] leading-tight text-neutral-900">
                  {r.label}
                </p>
                <p className="mt-1.5 font-serif text-[13px] leading-relaxed text-neutral-500">
                  {r.hint}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Film school teaser ─────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-12 items-start">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-neutral-500">
              Film school, included
            </p>
            <h2 className="mt-5 font-serif text-[44px] leading-[1.05] tracking-tight text-neutral-900">
              Every decision
              <br />
              is a lesson.
            </h2>
            <p className="mt-6 max-w-xl font-serif text-[17px] leading-[1.75] text-neutral-700">
              As your director makes a call — a lens, a hold, an eye-line, a grade —
              they cite the real film and the real technique it comes from. Each citation
              lands in your Film School sidebar with a rendered textbook reference page.
              When the film is locked, the lessons travel with you in the dossier as a
              printable plan.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {[
                "Goodfellas — long Steadicam tracking",
                "In the Mood for Love — magenta highlights",
                "Stalker — long contemplative takes",
                "Persona — micro-expression close-ups",
              ].map((tag) => (
                <span
                  key={tag}
                  className="border border-neutral-300 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/directors/yuki-sato.png"
              alt="Yuki Sato"
              className="aspect-[3/4] w-full object-cover grayscale"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/directors/aleksandra-volkov.png"
              alt="Aleksandra Volkov"
              className="aspect-[3/4] w-full object-cover grayscale mt-10"
            />
          </div>
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-900 pt-10 pb-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-neutral-500">
              Ready when you are
            </p>
            <h3 className="mt-3 font-serif text-[36px] leading-tight tracking-tight text-neutral-900">
              Cast your first director.
            </h3>
          </div>
          <button
            onClick={() => router.push("/dashboard/director")}
            className="group inline-flex h-14 items-center gap-3 bg-neutral-900 px-8 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-neutral-800 self-start md:self-auto"
          >
            Open the studio
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
          TwinLink · Director · 2026 · session {orgTag}·{userTag}
        </p>
      </section>
    </div>
  );
}
