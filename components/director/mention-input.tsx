"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MentionOption = {
  tag: string;
  kind: "plate" | "keyframe" | "shot" | "final";
  hint?: string;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: MentionOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSubmit?: () => void;
};

/**
 * Textarea that opens an @-mention picker when the user types "@". Arrow keys
 * navigate, Enter/Tab selects, Escape cancels. Insert replaces the in-progress
 * query with `@tag ` so follow-on typing continues cleanly.
 */
export function MentionInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  onSubmit,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [queryStart, setQueryStart] = useState(-1);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const filtered = useMemo(() => {
    if (!open) return [];
    const q = query.toLowerCase();
    const seen = new Set<string>();
    const matches = options.filter((o) => {
      if (seen.has(o.tag)) return false;
      seen.add(o.tag);
      if (!q) return true;
      return o.tag.toLowerCase().includes(q);
    });
    return matches.slice(0, 8);
  }, [open, query, options]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query, open]);

  function detectMention(next: string, caret: number) {
    // Walk backwards from caret to find an @ that starts a tag token.
    let i = caret - 1;
    while (i >= 0) {
      const ch = next[i];
      if (ch === "@") {
        // Preceding char must be whitespace or start of string
        const prev = i > 0 ? next[i - 1] : "";
        if (prev === "" || /\s/.test(prev)) {
          const q = next.slice(i + 1, caret);
          // Stop if query contains whitespace (user moved on)
          if (/\s/.test(q)) return null;
          return { start: i, query: q };
        }
        return null;
      }
      // Any whitespace before finding @ means no active mention
      if (/\s/.test(ch)) return null;
      i--;
    }
    return null;
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart;
    const m = detectMention(next, caret);
    if (m) {
      setOpen(true);
      setQuery(m.query);
      setQueryStart(m.start);
    } else {
      setOpen(false);
      setQuery("");
      setQueryStart(-1);
    }
  }

  function insertTag(tag: string) {
    if (queryStart < 0) return;
    const before = value.slice(0, queryStart);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const after = value.slice(caret);
    const inserted = `@${tag} `;
    const next = `${before}${inserted}${after}`;
    onChange(next);
    setOpen(false);
    setQuery("");
    setQueryStart(-1);
    // Restore caret after the inserted tag
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = before.length + inserted.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertTag(filtered[selectedIdx].tag);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  // Position the dropdown just above the textarea for consistency across browsers.
  const [wrapperRect, setWrapperRect] = useState<{ w: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const el = wrapperRef.current;
    if (!el) return;
    setWrapperRect({ w: el.clientWidth });
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {open && filtered.length > 0 && (
        <div
          style={{ width: wrapperRect?.w }}
          className="absolute bottom-full left-0 z-40 mb-1 max-h-56 overflow-y-auto border border-neutral-200 bg-white shadow-lg"
        >
          <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            Mention an asset
          </div>
          <ul>
            {filtered.map((opt, i) => (
              <li key={`${opt.kind}:${opt.tag}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertTag(opt.tag);
                  }}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left",
                    i === selectedIdx ? "bg-neutral-900 text-white" : "bg-white text-neutral-900"
                  )}
                >
                  <span className="font-mono text-[12px]">@{opt.tag}</span>
                  <span
                    className={cn(
                      "font-mono text-[12px] uppercase tracking-[0.18em]",
                      i === selectedIdx ? "text-white/70" : "text-neutral-500"
                    )}
                  >
                    {opt.kind}
                    {opt.hint ? ` · ${opt.hint}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
