// LLM client — OpenAI Responses API via raw fetch (no SDK dependency).
//
// Keeps the same surface the agent loop and script writer were written
// against (streamWithTools / generateStructuredJSON / generateText) so the
// tool-use conversation model — assistant `tool_use` blocks, user
// `tool_result` blocks — is unchanged. The mapping to Responses input items
// happens here at the boundary.
//
// Models (Sept 2026): gpt-6-sol ($2/$10 per MTok) runs the agent loop and
// the script writer; gpt-6-luna ($0.1/$0.5) does titles. Override with
// AGENT_MODEL / SCRIPT_MODEL.

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export const DEFAULT_AGENT_MODEL = "gpt-6-sol";
export const DEFAULT_SCRIPT_MODEL = "gpt-6-sol";
export const DEFAULT_FAST_MODEL = "gpt-6-luna";

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
};

export type { ClaudeMessage, ClaudeContentBlock };

// ============================================
// Tool Use Types (conversation model)
// ============================================

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

export type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "text_done"; fullText: string }
  | { type: "thinking_done"; thinkingText: string; signature: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_delta"; id: string; partialJson: string }
  | { type: "tool_use_done"; id: string; name: string; input: Record<string, unknown> }
  | { type: "message_done"; stopReason: string; usage?: { input_tokens: number; output_tokens: number } };

type ToolDefinitionInput = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

type LlmOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  messages: ClaudeMessage[];
};

type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

// ============================================
// Boundary mapping → Responses API
// ============================================

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set. Add it to your .env (see .env.example).");
  return key;
}

function toInstructions(system?: string | SystemBlock[]): string | undefined {
  if (!system) return undefined;
  if (typeof system === "string") return system;
  return system.map((b) => b.text).join("\n");
}

/** Map our conversation model to Responses `input` items. */
function toInputItems(messages: Array<ClaudeMessage | AnthropicMessage>): unknown[] {
  const items: unknown[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      items.push({ role: m.role, content: m.content });
      continue;
    }
    const textParts: unknown[] = [];
    const flush = () => {
      if (textParts.length === 0) return;
      items.push({ role: m.role, content: textParts.splice(0) });
    };
    for (const b of m.content as Array<ContentBlock | ClaudeContentBlock>) {
      if (b.type === "text") {
        textParts.push(
          m.role === "assistant" ? { type: "output_text", text: b.text } : { type: "input_text", text: b.text }
        );
      } else if (b.type === "image") {
        const url =
          b.source.type === "url" ? b.source.url : `data:${b.source.media_type};base64,${b.source.data}`;
        textParts.push({ type: "input_image", image_url: url });
      } else if (b.type === "tool_use") {
        flush();
        items.push({
          type: "function_call",
          call_id: b.id,
          name: b.name,
          arguments: JSON.stringify(b.input ?? {}),
        });
      } else if (b.type === "tool_result") {
        flush();
        items.push({ type: "function_call_output", call_id: b.tool_use_id, output: b.content });
      }
      // thinking blocks are dropped — not replayable
    }
    flush();
  }
  return items;
}

function toTools(tools: ToolDefinitionInput[]): unknown[] {
  return tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
    strict: false,
  }));
}

function reasoningFor(model: string): Record<string, unknown> | undefined {
  // GPT-6 family accepts a reasoning effort; keep it low for the agent loop
  // (tool routing is spelled out in the prompt) unless overridden.
  if (!/^gpt-6|^o\d|^gpt-5/.test(model)) return undefined;
  return { effort: process.env.LLM_REASONING_EFFORT || "low" };
}

async function postResponses(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;
    lastErr = `${res.status} - ${await res.text()}`;
    // Retry on rate limit / overload with backoff; fail fast on anything else.
    if (res.status !== 429 && res.status < 500) break;
    const waitMs = (attempt + 1) * 3000;
    console.warn(`[llm] ${res.status} — retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/3)`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error(`OpenAI API error: ${lastErr}`);
}

type ResponseOutputItem =
  | { type: "message"; content?: Array<{ type: string; text?: string }> }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: string };

function outputText(data: { output?: ResponseOutputItem[]; output_text?: string }): string {
  if (typeof data.output_text === "string" && data.output_text) return data.output_text;
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    if (item.type === "message" && "content" in item) {
      for (const c of item.content ?? []) if (c.type === "output_text" && c.text) parts.push(c.text);
    }
  }
  return parts.join("");
}

// ============================================
// Public API
// ============================================

export async function generateText(options: LlmOptions): Promise<string> {
  const { model = DEFAULT_FAST_MODEL, maxTokens = 16384, temperature = 0.7, system, messages } = options;
  console.log("[llm] generateText model:", model, "messages:", messages.length);
  const res = await postResponses({
    model,
    instructions: toInstructions(system),
    input: toInputItems(messages),
    max_output_tokens: maxTokens,
    temperature,
    reasoning: reasoningFor(model),
  });
  const data = await res.json();
  if (data.status === "incomplete") console.warn("[llm] Response incomplete:", data.incomplete_details);
  const text = outputText(data);
  console.log("[llm] Response length:", text.length);
  return text;
}

/**
 * Structured JSON via a forced function call whose parameters match the
 * desired shape. Guarantees a parseable object without markdown fences.
 */
export async function generateStructuredJSON<T>(options: {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  messages: ClaudeMessage[];
  schema: Record<string, unknown>;
  schemaName?: string;
  signal?: AbortSignal;
}): Promise<T> {
  const { model = DEFAULT_SCRIPT_MODEL, maxTokens = 16384, temperature = 0.7, system, messages, schema, schemaName, signal } =
    options;
  const toolName = schemaName || "output";
  console.log("[llm] generateStructuredJSON model:", model, "tool:", toolName, "messages:", messages.length);

  // Fail fast on dead sockets so the caller can retry.
  const inner = new AbortController();
  const timer = setTimeout(() => inner.abort(new Error("inner-timeout")), 9 * 60_000);
  if (signal) {
    if (signal.aborted) inner.abort(signal.reason);
    else signal.addEventListener("abort", () => inner.abort(signal.reason), { once: true });
  }
  let data: { output?: ResponseOutputItem[] };
  try {
    const res = await postResponses(
      {
        model,
        instructions: toInstructions(system),
        input: toInputItems(messages),
        max_output_tokens: maxTokens,
        temperature,
        reasoning: reasoningFor(model),
        tools: [{ type: "function", name: toolName, description: "Output structured data", parameters: schema, strict: false }],
        tool_choice: { type: "function", name: toolName },
        parallel_tool_calls: false,
      },
      inner.signal
    );
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }
  const call = (data.output ?? []).find((i) => i.type === "function_call") as
    | { type: "function_call"; arguments: string }
    | undefined;
  if (!call) {
    console.error("[llm] No function_call in response:", JSON.stringify(data.output).slice(0, 500));
    throw new Error("Model did not return the structured output call.");
  }
  return JSON.parse(call.arguments) as T;
}

export async function generateJSON<T>(options: LlmOptions): Promise<T> {
  return generateStructuredJSON<T>({
    ...options,
    schema: {
      type: "object",
      additionalProperties: true,
      description: "The JSON output. Return the full structured data as requested in the prompt.",
    },
    schemaName: "output",
  });
}

export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController | null = null;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });
  function send(event: string, data: unknown) {
    if (!controller) return;
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  }
  function close() {
    try {
      controller?.close();
    } catch {
      // already closed
    }
  }
  return { stream, send, close };
}

// ============================================
// Stream with Tool Use (for autonomous agent)
// ============================================

export async function* streamWithTools(options: {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string | SystemBlock[];
  messages: AnthropicMessage[];
  tools: ToolDefinitionInput[];
  thinking?: boolean;
  thinkingBudget?: number;
}): AsyncGenerator<StreamEvent> {
  const { model = DEFAULT_AGENT_MODEL, maxTokens = 16384, temperature = 0.7, system, messages, tools } = options;
  console.log("[llm] streamWithTools model:", model, "messages:", messages.length, "tools:", tools.length);

  const res = await postResponses({
    model,
    instructions: toInstructions(system),
    input: toInputItems(messages),
    tools: toTools(tools),
    max_output_tokens: maxTokens,
    temperature,
    reasoning: reasoningFor(model),
    stream: true,
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // output_index → function call identity (arguments stream by index).
  const calls = new Map<number, { id: string; name: string; json: string }>();
  let currentText = "";
  let sawToolCall = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(raw);
      } catch {
        continue;
      }
      const type = ev.type as string;

      if (type === "response.output_item.added") {
        const item = ev.item as Record<string, unknown>;
        if (item?.type === "function_call") {
          const idx = ev.output_index as number;
          const id = (item.call_id as string) || (item.id as string);
          const name = item.name as string;
          calls.set(idx, { id, name, json: "" });
          sawToolCall = true;
          yield { type: "tool_use_start", id, name };
        }
      } else if (type === "response.function_call_arguments.delta") {
        const call = calls.get(ev.output_index as number);
        if (call) {
          const delta = (ev.delta as string) || "";
          call.json += delta;
          yield { type: "tool_use_delta", id: call.id, partialJson: delta };
        }
      } else if (type === "response.function_call_arguments.done") {
        const call = calls.get(ev.output_index as number);
        if (call) {
          const argsText = (ev.arguments as string) || call.json;
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(argsText || "{}");
          } catch {
            console.error("[llm] Failed to parse tool arguments:", argsText.slice(0, 200));
          }
          yield { type: "tool_use_done", id: call.id, name: call.name, input };
        }
      } else if (type === "response.output_text.delta") {
        const text = (ev.delta as string) || "";
        currentText += text;
        yield { type: "text_delta", text };
      } else if (type === "response.output_text.done") {
        const full = (ev.text as string) || currentText;
        if (full) yield { type: "text_done", fullText: full };
        currentText = "";
      } else if (type === "response.completed" || type === "response.incomplete") {
        const response = ev.response as Record<string, unknown>;
        const usage = response?.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        const incomplete = type === "response.incomplete";
        yield {
          type: "message_done",
          stopReason: incomplete ? "max_tokens" : sawToolCall ? "tool_use" : "end_turn",
          usage: usage ? { input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0 } : undefined,
        };
      } else if (type === "response.failed" || type === "error") {
        const err = (ev.error ?? (ev.response as Record<string, unknown>)?.error) as { message?: string } | undefined;
        throw new Error(`OpenAI stream error: ${err?.message ?? raw.slice(0, 200)}`);
      }
    }
  }
  if (currentText) yield { type: "text_done", fullText: currentText };
}

export async function* streamText(options: LlmOptions): AsyncGenerator<string> {
  const { model = DEFAULT_FAST_MODEL, maxTokens = 16384, temperature = 0.7, system, messages } = options;
  const res = await postResponses({
    model,
    instructions: toInstructions(system),
    input: toInputItems(messages),
    max_output_tokens: maxTokens,
    temperature,
    reasoning: reasoningFor(model),
    stream: true,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.type === "response.output_text.delta" && ev.delta) yield ev.delta as string;
      } catch {
        // skip
      }
    }
  }
}
