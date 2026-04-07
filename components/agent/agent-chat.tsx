"use client";

import { useState, useRef, useEffect } from "react";
import { AgentSteps } from "./agent-steps";
import { AgentMessage } from "./agent-message";
import { useTranslation } from "@/lib/i18n/use-translations";
import { Send, Square } from "lucide-react";

type Message = {
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
};

type AgentEvent = {
  type: string;
  [key: string]: unknown;
};

type Props = {
  brandId: string;
  taskType: string;
  language?: string;
  onComplete?: (generationId: string) => void;
};

export function AgentChat({
  brandId,
  taskType,
  language = "en",
  onComplete,
}: Props) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(4);
  const [stepDescription, setStepDescription] = useState("");
  const [assets, setAssets] = useState<
    Array<{ id: string; url: string; variant: number }>
  >([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Ref to track the generation ID for follow-up messages
  const generationIdRef = useRef<string | null>(null);

  async function startAgent(userPrompt?: string) {
    setIsRunning(true);
    abortRef.current = new AbortController();

    const currentPrompt = userPrompt || `Generate ${taskType} for this brand`;

    // Build conversation history from previous messages (user + agent only, not system)
    // This gives the agent memory of what was discussed before
    const conversationHistory = messages
      .filter((msg) => msg.role === "user" || msg.role === "agent")
      .map((msg) => ({
        role: (msg.role === "agent" ? "assistant" : "user") as "user" | "assistant",
        content: msg.content,
      }));

    if (userPrompt) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userPrompt, timestamp: new Date().toISOString() },
      ]);
    }

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          language,
          prompt: currentPrompt,
          conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
          generationId: generationIdRef.current || undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error("Agent execution failed");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const eventMatch = block.match(/event: (.+)/);
          const dataMatch = block.match(/data: (.+)/);

          if (eventMatch && dataMatch) {
            try {
              const event: AgentEvent = JSON.parse(dataMatch[1]);
              handleEvent(eventMatch[1], event);
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `Error: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsRunning(false);
    }
  }

  function handleEvent(eventType: string, data: AgentEvent) {
    switch (eventType) {
      case "step_start":
        setCurrentStep(data.step as number);
        setTotalSteps(data.totalSteps as number);
        setStepDescription(data.description as string);
        break;

      case "step_progress":
        setStepDescription(data.message as string);
        break;

      case "step_complete":
        break;

      case "agent_message":
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content: data.content as string,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case "asset_ready":
        setAssets((prev) => [
          ...prev,
          {
            id: data.assetId as string,
            url: data.url as string,
            variant: data.variant as number,
          },
        ]);
        break;

      case "session_start":
        // Capture the generation ID for follow-up messages
        if (data.generationId) {
          generationIdRef.current = data.generationId as string;
        }
        break;

      case "generation_complete":
        onComplete?.(data.generationId as string);
        break;

      case "error":
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: data.message as string,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setIsRunning(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const msg = input.trim();
    setInput("");

    if (!isRunning) {
      startAgent(msg);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: msg, timestamp: new Date().toISOString() },
      ]);
    }
  }

  // Auto-start the agent on mount
  useEffect(() => {
    startAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Step progress */}
      {isRunning && (
        <AgentSteps
          currentStep={currentStep}
          totalSteps={totalSteps}
          description={stepDescription}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4" ref={scrollRef}>
        <div className="space-y-4 py-4">
          {messages.map((msg, i) => (
            <AgentMessage key={i} message={msg} />
          ))}
        </div>

        {/* Agent thinking indicator */}
        {isRunning && messages.length > 0 && (
          <div className="px-2 pb-4">
            <p className="text-[14px] text-[#6B7280] italic">Thinking...</p>
          </div>
        )}

        {/* Generated assets */}
        {assets.length > 0 && (
          <div className="grid grid-cols-2 gap-3 py-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="overflow-hidden rounded-xl border border-[#F0F0F0] transition-shadow hover:shadow-medium"
                style={{ width: 200 }}
              >
                <img
                  src={asset.url}
                  alt={`Variant ${asset.variant}`}
                  className="aspect-square w-full object-cover"
                />
                <div className="p-2 text-center text-[13px] text-[#9CA3AF]">
                  Variant {asset.variant}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-[#F0F0F0] p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.agent.typeSomething}
          className="min-h-[44px] max-h-32 flex-1 resize-none rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] text-[#1A1A1A] placeholder:text-[#D1D5DB] outline-none transition-colors focus:border-[#9CA3AF]"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={handleStop}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#EF4444] transition-colors hover:bg-[#FEF2F2]"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#4D5D4B] text-white transition-colors hover:bg-[#3d4a3b] disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}
