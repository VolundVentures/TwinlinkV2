"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2, Plus, X } from "lucide-react";
import type {
  AspectRatio,
  BriefInput,
  CastedDirector,
  ReferenceImage,
} from "./director-types";
import { ASPECT_OPTIONS, DURATION_PRESETS } from "./director-types";

type Brand = { id: string; name: string };

export function BriefForm({
  brands,
  onStart,
  onChangeCast,
  cast,
  disabled,
}: {
  brands: Brand[];
  onStart: (input: BriefInput) => void;
  /** Optional — open the cast step to swap directors. */
  onChangeCast?: () => void;
  cast?: { lead: CastedDirector | null; co: CastedDirector | null };
  disabled?: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [brandId, setBrandId] = useState<string | undefined>(
    brands.length === 1 ? brands[0].id : undefined
  );
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [refUrl, setRefUrl] = useState("");
  const [refLabel, setRefLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canStart = prompt.trim().length > 8 && !disabled && !submitting && !uploading;

  function addRefByUrl() {
    if (!refUrl.trim() || !refLabel.trim()) return;
    setReferences((r) => [...r, { url: refUrl.trim(), label: refLabel.trim() }]);
    setRefUrl("");
    setRefLabel("");
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("name", file.name);
        fd.append("source", "brief");
        const res = await fetch("/api/assets", { method: "POST", body: fd });
        if (!res.ok) {
          console.error("upload failed", await res.text());
          continue;
        }
        const data = await res.json();
        const url = data?.asset?.url;
        if (url) {
          setReferences((r) => [
            ...r,
            { url, label: file.name.replace(/\.[^.]+$/, "") },
          ]);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeRef(index: number) {
    setReferences((r) => r.filter((_, i) => i !== index));
  }

  const isWideAspect = aspectRatio === "21:9" || aspectRatio === "4:3" || aspectRatio === "3:4";

  return (
    <div className="mx-auto w-full max-w-3xl px-10 py-14">
      {/* Header */}
      <div className="mb-12">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          New film &middot; brief
        </p>
        <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight text-neutral-900">
          Direct a film.
        </h1>
        <p className="mt-4 max-w-xl font-serif text-[15px] leading-relaxed text-neutral-700">
          Describe the film with specifics — tone, references, what the viewer should feel.
          Your director{cast?.co ? "s" : ""} return a treatment for your approval. Nothing is
          generated until you bless it.
        </p>
      </div>

      {/* Cast row — directors go here, before the brief itself */}
      {cast && (cast.lead || cast.co) && (
        <div className="mb-10 border-y border-neutral-200 py-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              Cast
            </p>
            {onChangeCast && (
              <button
                type="button"
                onClick={onChangeCast}
                className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
              >
                change directors
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {cast.lead && <DirectorChip d={cast.lead} role="Lead" />}
            {cast.co && <DirectorChip d={cast.co} role="Co" />}
          </div>
        </div>
      )}

      <div className="space-y-10">
        {/* Brand (if multiple) */}
        {brands.length > 1 && (
          <div>
            <Label className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              Brand
            </Label>
            <div className="mt-3 flex flex-wrap gap-2">
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBrandId(b.id)}
                  className={cn(
                    "border px-4 py-2 font-mono text-[12px] uppercase tracking-[0.18em] transition-colors",
                    brandId === b.id
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900"
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Brief */}
        <div>
          <Label className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            The brief
          </Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A slow, almost wordless 60-second film about the first minute of the morning. Our espresso machine is the third character, next to steam and light. Think Sofia Coppola, Jonathan Glazer's 'Under the Skin' domestic interiors, early Mubi shorts. One location — the kitchen. End card: 'Before anyone else.'"
            className="mt-3 min-h-[160px] resize-none rounded-none border-neutral-300 bg-white font-serif text-[15px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus-visible:border-neutral-900 focus-visible:ring-0"
          />
          <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            Specific beats vague. Name references. Name the end card.
          </p>
        </div>

        {/* Duration */}
        <div>
          <Label className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            Duration
          </Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.seconds}
                type="button"
                onClick={() => setDurationSeconds(p.seconds)}
                className={cn(
                  "border px-5 py-2 font-mono text-[11px] tabular-nums transition-colors",
                  durationSeconds === p.seconds
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect */}
        <div>
          <Label className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            Aspect ratio
          </Label>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAspectRatio(opt.value)}
                className={cn(
                  "flex flex-col items-start border px-4 py-3 text-left transition-colors",
                  aspectRatio === opt.value
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900"
                )}
              >
                <span className="font-mono text-[13px] tabular-nums">{opt.label}</span>
                <span
                  className={cn(
                    "mt-0.5 font-mono text-[12px] uppercase tracking-[0.18em]",
                    aspectRatio === opt.value ? "text-neutral-400" : "text-neutral-500"
                  )}
                >
                  {opt.hint}
                </span>
              </button>
            ))}
          </div>
          {isWideAspect && (
            <p className="mt-3 border-l-2 border-neutral-900 bg-neutral-50 px-3 py-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700">
              Note · {aspectRatio} renders at the chosen ratio.
              16:9 is the cinematic default; 21:9 letterboxes from a 16:9 master in post.
            </p>
          )}
        </div>

        {/* Reference images */}
        <div>
          <Label className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            Reference images (optional)
          </Label>
          <p className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
            Upload or paste URLs · used as plate references (logos, products, actors, locations)
          </p>

          {/* Existing references */}
          {references.length > 0 && (
            <ul className="mt-3 space-y-2">
              {references.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 border border-neutral-200 bg-white px-3 py-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.url}
                    alt={r.label}
                    className="h-10 w-10 shrink-0 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[13px] text-neutral-900">
                      {r.label}
                    </p>
                    <p className="truncate font-mono text-[11px] text-neutral-400">
                      {r.url}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRef(i)}
                    aria-label="Remove"
                    className="text-neutral-400 hover:text-neutral-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* URL paste row */}
          <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              type="url"
              placeholder="https://…"
              value={refUrl}
              onChange={(e) => setRefUrl(e.target.value)}
              className="h-10 rounded-none border border-neutral-300 bg-white px-3 font-mono text-[12px] text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900"
            />
            <input
              type="text"
              placeholder="label (e.g. Peugeot emblem)"
              value={refLabel}
              onChange={(e) => setRefLabel(e.target.value)}
              className="h-10 rounded-none border border-neutral-300 bg-white px-3 font-serif text-[13px] text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900"
            />
            <button
              type="button"
              onClick={addRefByUrl}
              disabled={!refUrl.trim() || !refLabel.trim()}
              className="flex h-10 items-center gap-1 border border-neutral-300 bg-white px-3 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700 hover:border-neutral-900 disabled:opacity-30"
            >
              <Plus className="h-3 w-3" /> add
            </button>
          </div>

          {/* File upload */}
          <div className="mt-2 flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleUpload(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-9 items-center border border-neutral-300 bg-white px-3 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700 hover:border-neutral-900 disabled:opacity-40"
            >
              {uploading ? (
                <>
                  <Loader2 className="me-1.5 h-3 w-3 animate-spin" /> uploading
                </>
              ) : (
                "upload files"
              )}
            </button>
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
              or drag directly into this panel
            </p>
          </div>
        </div>

        {/* Start */}
        <div className="border-t border-neutral-200 pt-8">
          <Button
            type="button"
            disabled={!canStart}
            onClick={() => {
              if (!canStart) return;
              setSubmitting(true);
              onStart({
                prompt: prompt.trim(),
                brandId,
                durationSeconds,
                aspectRatio,
                referenceImages: references.length ? references : undefined,
                leadDirectorId: cast?.lead?.id,
                coDirectorId: cast?.co?.id ?? null,
              });
            }}
            className="h-12 w-full rounded-none bg-neutral-900 px-6 font-mono text-[12px] uppercase tracking-[0.2em] text-white hover:bg-neutral-800 disabled:opacity-30"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Begin production →"
            )}
          </Button>
          <p className="mt-3 text-center font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            8 rooms &middot; 5 approval gates &middot; your word at every stage
          </p>
        </div>
      </div>
    </div>
  );
}

function DirectorChip({
  d,
  role,
}: {
  d: CastedDirector;
  role: "Lead" | "Co";
}) {
  return (
    <div className="flex items-center gap-3 border border-neutral-300 bg-white px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={d.portraitUrl}
        alt={d.name}
        className="h-9 w-9 shrink-0 object-cover"
      />
      <div className="min-w-0">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          {role}
        </p>
        <p className="font-serif text-[13px] leading-tight text-neutral-900">
          {d.name}
        </p>
        <p className="truncate font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          {d.school}
        </p>
      </div>
    </div>
  );
}
