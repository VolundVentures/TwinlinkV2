"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { MentionInput, type MentionOption } from "./mention-input";
import { AttachButton } from "./attach-button";
import { FilmSchoolButton } from "./film-school";
import type { ChatMessage, ToolActivity } from "./director-types";

const STAGE_LABELS: Record<string, string> = {
  idle: "Idle",
  running: "Working",
  awaiting_approval: "Awaiting approval",
  complete: "Complete",
  error: "Error",
};

const PHASES = ["PITCH", "SCRIPT", "WORLD", "STORYBOARD", "SHOOT", "CUT", "POST", "PREMIERE"];

export function ChatPane({
  messages,
  activity,
  thinking,
  canSend,
  onSend,
  onStop,
  status,
  spec,
  mentions,
  phase,
  lessonCount,
  onOpenFilmSchool,
}: {
  messages: ChatMessage[];
  activity: ToolActivity[];
  thinking: string;
  canSend: boolean;
  onSend: (prompt: string) => void;
  onStop: () => void;
  status: "idle" | "running" | "awaiting_approval" | "complete" | "error";
  spec: { durationSeconds: number; aspectRatio: string } | null;
  mentions: MentionOption[];
  /** AUTEUR — current room (PITCH / SCRIPT / WORLD / ...). */
  phase?: string;
  lessonCount?: number;
  onOpenFilmSchool?: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activity, thinking]);

  const runningActivity = activity.filter((a) => a.status === "running");
  // Only TRUE errors deserve the prominent red banner — directive markers
  // ("↗ Treatment approved · starting plates") render inline in the message
  // list as quiet grey tags.
  const errorMessage = messages.find(
    (m) => m.role === "system" && !m.content.trim().startsWith("↗")
  );

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-neutral-200 bg-white">
      {/* Header */}
      <header className="border-b border-neutral-200">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              Director
            </p>
            {spec && (
              <p className="mt-1 font-mono text-[11px] text-neutral-900 tabular-nums">
                {spec.durationSeconds}s &middot; {spec.aspectRatio}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onOpenFilmSchool && (
              <FilmSchoolButton
                count={lessonCount || 0}
                onOpen={onOpenFilmSchool}
              />
            )}
            <span
              className={cn(
                "border px-2 py-1 font-mono text-[12px] uppercase tracking-[0.18em]",
                status === "running" && "border-neutral-900 text-neutral-900",
                status === "awaiting_approval" && "border-neutral-900 bg-neutral-900 text-white",
                status === "complete" && "border-neutral-900 text-neutral-900",
                status === "idle" && "border-neutral-300 text-neutral-500",
                status === "error" && "border-red-600 text-red-600"
              )}
            >
              {STAGE_LABELS[status] || status}
            </span>
          </div>
        </div>
        {/* Phase indicator strip */}
        {phase && <PhaseStrip current={phase} />}
      </header>

      {/* Error banner */}
      {status === "error" && errorMessage && (
        <div className="border-b border-red-300 bg-red-50 px-5 py-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-red-700">
              Error
            </p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(errorMessage.content)}
              className="font-mono text-[12px] uppercase tracking-[0.18em] text-red-700 hover:text-red-900"
            >
              copy
            </button>
          </div>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-red-900 selection:bg-red-200">
            {errorMessage.content}
          </pre>
          <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.18em] text-red-700">
            Send a reply to retry
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 min-h-0">
        <div className="space-y-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}

          {/* Working indicator — visible whenever the agent is running */}
          {status === "running" && runningActivity.length === 0 && (
            <div className="flex items-center gap-3 border-l-2 border-neutral-900 bg-white/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-900"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-900"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-900"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700">
                Director thinking
              </span>
            </div>
          )}

          {runningActivity.length > 0 && (
            <div className="border-l-2 border-neutral-900 bg-white px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-900 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-900" />
                </span>
                <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700">
                  In progress · {runningActivity.length}
                </p>
              </div>
              <ul className="space-y-1.5">
                {runningActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1 w-1 rounded-full bg-neutral-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-900">
                        {a.name.replace(/_/g, " ")}
                      </p>
                      {a.message && (
                        <p className="truncate font-serif text-[11px] text-neutral-500">
                          {a.message}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 px-5 py-4">
        <MentionInput
          value={input}
          onChange={setInput}
          options={mentions}
          placeholder="Reply to the director… type @ to reference an asset"
          disabled={!canSend}
          onSubmit={() => {
            if (canSend && input.trim()) {
              onSend(input.trim());
              setInput("");
            }
          }}
          className="block min-h-[80px] w-full resize-none rounded-none border border-neutral-200 bg-white p-3.5 font-serif text-[16px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 disabled:opacity-40"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AttachButton
              disabled={!canSend}
              source="chat"
              onAttached={({ url, label }) => {
                const suffix = `\n\n[Attached reference: ${label} — ${url}]`;
                setInput((v) => (v.endsWith(suffix) ? v : v + suffix));
              }}
            />
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              ⌘↵ · @ mention · 📎 attach
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status === "running" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onStop}
                className="h-8 rounded-none font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
              >
                Stop
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={!canSend || input.trim().length === 0}
              onClick={() => {
                onSend(input.trim());
                setInput("");
              }}
              className="h-8 rounded-none bg-neutral-900 px-4 font-mono text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhaseStrip({ current }: { current: string }) {
  const idx = PHASES.indexOf(current);
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-5 pb-3">
      {PHASES.map((p, i) => {
        const state = i < idx ? "done" : i === idx ? "active" : "pending";
        return (
          <div key={p} className="flex items-center gap-1">
            <span
              className={cn(
                "font-mono text-[12px] uppercase tracking-[0.18em]",
                state === "active" && "text-neutral-900",
                state === "done" && "text-neutral-400 line-through decoration-1",
                state === "pending" && "text-neutral-300"
              )}
            >
              {p}
            </span>
            {i < PHASES.length - 1 && (
              <span
                className={cn(
                  "h-px w-3",
                  state === "done" ? "bg-neutral-300" : "bg-neutral-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    // Edit-modal directives are machine-generated instructions — render them
    // as a muted system-intent card so the conversation isn't cluttered with
    // scaffolding text. Extract the actual instruction from "Instruction: ..."
    const isDirective =
      /^(Edit @|Re-shoot @|Edit shot |Edit keyframe )/.test(msg.content.trim());
    if (isDirective) {
      const m = msg.content.match(/Instruction:\s*([\s\S]*?)$/);
      const headMatch = msg.content.match(/^(Edit|Re-shoot)\s+(\S+)/);
      const target = headMatch?.[2] || "";
      const verb = headMatch?.[1]?.toLowerCase() || "edit";
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%] min-w-0 border border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 break-words">
              {verb} · {target}
            </p>
            <p className="mt-1 font-serif text-[13px] leading-snug text-neutral-800 break-words whitespace-pre-wrap">
              {m?.[1]?.trim() || msg.content}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] min-w-0 bg-neutral-900 px-4 py-3 font-serif text-[15px] leading-relaxed text-white break-words whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  if (msg.role === "system") {
    // System messages split two ways:
    //   - Directive markers (start with "↗") — quiet grey tags showing the
    //     user where they are in the flow ("Treatment approved · starting
    //     plates"). Replaces the verbose internal directives that used to be
    //     shown verbatim.
    //   - Errors (everything else) — red.
    const isDirective = msg.content.trim().startsWith("↗");
    if (isDirective) {
      return (
        <div className="px-1 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          {msg.content}
        </div>
      );
    }
    return (
      <div className="border-l-2 border-red-500 bg-red-50 px-3 py-2 font-mono text-[11px] leading-snug text-red-900 break-words whitespace-pre-wrap">
        {msg.content}
      </div>
    );
  }
  // Long director messages get collapsed — full rendering happens in workspace.
  const isLong = msg.content.length > 280;
  return (
    <div className="flex gap-3">
      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="mb-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          Director
        </p>
        {isLong ? (
          <div>
            <p className="font-serif text-[15px] leading-relaxed text-neutral-700 break-words">
              {msg.content.replace(/[#*_`>-]/g, "").slice(0, 220).trim()}
              <span className="text-neutral-400">… </span>
            </p>
            <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              full version in the workspace →
            </p>
          </div>
        ) : (
          <Markdown className="text-neutral-900 break-words [overflow-wrap:anywhere] [&_p]:my-2 [&_p]:text-[16px] [&_p]:leading-relaxed [&_a]:break-all [&_code]:break-all">
            {msg.content}
          </Markdown>
        )}
      </div>
    </div>
  );
}
