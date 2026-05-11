"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { MentionInput, type MentionOption } from "./mention-input";
import { AttachButton } from "./attach-button";

export type AssetModalInput = {
  kind: "plate" | "keyframe" | "shot" | "final";
  url: string;
  ref?: string;
  description?: string;
} | null;

export function AssetModal({
  asset,
  onClose,
  onRequestEdit,
  mentions = [],
}: {
  asset: AssetModalInput;
  onClose: () => void;
  /** Send an edit instruction for this asset. `ref` is the @tag (or shot id). */
  onRequestEdit?: (ref: string, instruction: string, kind: "plate" | "keyframe" | "shot") => void;
  mentions?: MentionOption[];
}) {
  const [instruction, setInstruction] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setInstruction("");
    setSubmitting(false);
  }, [asset?.url]);

  useEffect(() => {
    if (!asset) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [asset, onClose]);

  if (!asset) return null;

  const isVideo = asset.kind === "shot" || asset.kind === "final";
  const canEdit =
    !!onRequestEdit &&
    !!asset.ref &&
    (asset.kind === "plate" || asset.kind === "keyframe" || asset.kind === "shot");

  async function submit() {
    if (!asset || !asset.ref || !onRequestEdit || !instruction.trim()) return;
    if (asset.kind !== "plate" && asset.kind !== "keyframe" && asset.kind !== "shot") return;
    setSubmitting(true);
    try {
      onRequestEdit(asset.ref, instruction.trim(), asset.kind);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-6xl flex-col md:flex-row gap-6"
      >
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          {isVideo ? (
            <video
              src={asset.url}
              className="max-h-[80vh] max-w-full"
              controls
              autoPlay
              playsInline
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={asset.url}
              alt={asset.ref || "asset"}
              className="max-h-[80vh] max-w-full object-contain"
            />
          )}
        </div>

        <aside className="w-full md:w-96 shrink-0 flex flex-col gap-5 overflow-y-auto text-white">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-white/60">
              {asset.kind}
            </p>
            {asset.ref && (
              <p className="mt-1 font-mono text-[13px] text-white">{asset.ref}</p>
            )}
          </div>

          {asset.description && (
            <div className="border-t border-white/15 pt-4">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-white/60">
                Prompt
              </p>
              <p className="mt-2 whitespace-pre-wrap font-serif text-[13px] leading-relaxed text-white/90">
                {asset.description}
              </p>
            </div>
          )}

          {canEdit && (
            <div className="border-t border-white/15 pt-4">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-white/60">
                Request a change
              </p>
              <p className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-white/40">
                One surgical edit · preserve the rest
              </p>
              <div className="mt-2">
                <MentionInput
                  value={instruction}
                  onChange={setInstruction}
                  options={mentions}
                  placeholder={
                    asset.kind === "shot"
                      ? "Slow the dolly. Reference @shot_1 for continuity."
                      : "Warm the light 500K. Add @peugeot_emblem to the jacket pocket. Preserve pose."
                  }
                  onSubmit={submit}
                  className="block min-h-[120px] w-full resize-none bg-white/5 p-3 font-serif text-[13px] leading-relaxed text-white placeholder:text-white/30 outline-none border border-white/15 focus:border-white/50"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AttachButton
                  source="edit"
                  onAttached={({ url, label }) => {
                    const suffix = `\n\n[Attached reference: ${label} — ${url}]`;
                    setInstruction((v) => (v.endsWith(suffix) ? v : v + suffix));
                  }}
                  className="border-white/25 bg-transparent text-white/80 hover:border-white hover:text-white"
                />
                <button
                  type="button"
                  disabled={!instruction.trim() || submitting}
                  onClick={submit}
                  className="inline-flex h-10 items-center bg-white px-4 font-mono text-[12px] uppercase tracking-[0.18em] text-black hover:bg-neutral-200 disabled:opacity-40"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : asset.kind === "shot" ? (
                    "Re-shoot this"
                  ) : (
                    "Apply edit"
                  )}
                </button>
                <a
                  href={asset.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center border border-white/25 px-4 font-mono text-[12px] uppercase tracking-[0.18em] text-white/80 hover:border-white/60 hover:text-white"
                >
                  Download
                </a>
              </div>
            </div>
          )}

          {!canEdit && (
            <div className="border-t border-white/15 pt-4">
              <a
                href={asset.url}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center border border-white/25 px-4 font-mono text-[12px] uppercase tracking-[0.18em] text-white/80 hover:border-white/60 hover:text-white"
              >
                Download
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
