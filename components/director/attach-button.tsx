"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onAttached: (attachment: { url: string; label: string }) => void;
  disabled?: boolean;
  source?: "chat" | "edit" | "brief";
  className?: string;
};

/**
 * Small paperclip button that uploads an image via /api/assets and returns
 * the public URL. Used by the chat input and edit modal so the user can
 * attach a reference while typing.
 */
export function AttachButton({ onAttached, disabled, source = "chat", className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("name", file.name);
        fd.append("source", source);
        const res = await fetch("/api/assets", { method: "POST", body: fd });
        if (!res.ok) {
          console.error("[attach] upload failed", await res.text());
          continue;
        }
        const data = await res.json();
        const url = data?.asset?.url as string | undefined;
        if (url) {
          onAttached({ url, label: file.name.replace(/\.[^.]+$/, "") });
        }
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 border border-neutral-200 bg-white px-2.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-40",
          className
        )}
        aria-label="Attach reference image"
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
        {uploading ? "Uploading" : "Attach"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}
