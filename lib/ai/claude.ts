const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

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
// Tool Use Types
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

type ClaudeOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  messages: ClaudeMessage[];
};

export async function generateText(options: ClaudeOptions): Promise<string> {
  const {
    model = "claude-opus-4-6",
    maxTokens = 16384,
    temperature = 0.7,
    system,
    messages,
  } = options;

  console.log("[claude] Calling model:", model, "maxTokens:", maxTokens, "messages:", messages.length);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "interleaved-thinking-2025-05-14",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      ...(system && { system }),
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[claude] API error:", response.status, errorText);
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Check for stop_reason to detect truncation
  if (data.stop_reason === "max_tokens") {
    console.warn("[claude] Response was truncated (hit max_tokens limit)");
  }

  // Find the actual text block — skip thinking blocks (from interleaved-thinking beta)
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  const text = textBlock?.text || data.content?.[0]?.text || "";
  console.log("[claude] Response length:", text.length, "stop_reason:", data.stop_reason);
  return text;
}

/**
 * Uses Claude's tool_use feature to produce reliable structured JSON output.
 * Instead of asking the model to output raw JSON (which can include markdown fences,
 * trailing text, or malformed syntax), this defines a tool whose input_schema matches
 * the desired output shape and forces Claude to call that tool, guaranteeing valid JSON.
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
  const {
    model = "claude-opus-4-6",
    maxTokens = 16384,
    temperature = 0.7,
    system,
    messages,
    schema,
    schemaName,
    signal,
  } = options;

  const toolName = schemaName || "output";

  const tool = {
    name: toolName,
    description: "Output structured data",
    input_schema: schema,
  };

  console.log(
    "[claude] generateStructuredJSON model:",
    model,
    "tool:",
    toolName,
    "messages:",
    messages.length
  );

  // Inner abort: we want to fail fast on socket hangs (ECONNRESET) so we can
  // retry instead of sitting on a dead connection. 9 minutes is generous for
  // Opus + interleaved thinking on a ~16k-token structured output.
  const innerController = new AbortController();
  const innerTimer = setTimeout(() => innerController.abort(new Error("inner-timeout")), 9 * 60_000);
  if (signal) {
    if (signal.aborted) innerController.abort(signal.reason);
    else signal.addEventListener("abort", () => innerController.abort(signal.reason), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      signal: innerController.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "interleaved-thinking-2025-05-14",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(system && { system }),
        messages,
        tools: [tool],
        tool_choice: { type: "tool", name: toolName },
      }),
    });
  } finally {
    clearTimeout(innerTimer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[claude] generateStructuredJSON API error:", response.status, errorText);

    // Retry up to 3 times on 529 with exponential backoff
    if (response.status === 529) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const waitMs = attempt * 3000;
        console.warn(`[claude] Model overloaded, waiting ${waitMs / 1000}s (attempt ${attempt}/3)...`);
        await new Promise((r) => setTimeout(r, waitMs));
        const retryRes = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
      "anthropic-beta": "interleaved-thinking-2025-05-14",
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            ...(system && { system }),
            messages,
            tools: [tool],
            tool_choice: { type: "tool", name: toolName },
          }),
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const retryBlock = retryData.content?.find(
            (block: { type: string }) => block.type === "tool_use"
          );
          if (retryBlock) return retryBlock.input as T;
        }
        if (retryRes.status !== 529) break;
      }
    }

    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  const toolUseBlock = data.content?.find(
    (block: { type: string }) => block.type === "tool_use"
  );

  if (!toolUseBlock) {
    console.error("[claude] No tool_use block in response. Content:", JSON.stringify(data.content).slice(0, 500));
    throw new Error("Claude did not return a tool_use block. Unexpected response format.");
  }

  console.log("[claude] generateStructuredJSON success, tool:", toolUseBlock.name);

  return toolUseBlock.input as T;
}

export async function generateJSON<T>(options: ClaudeOptions): Promise<T> {
  // Use generateStructuredJSON with a permissive schema that accepts any JSON object.
  // This leverages Claude's tool_use for reliable JSON output instead of the fragile
  // "respond with ONLY valid JSON" approach.
  return generateStructuredJSON<T>({
    model: options.model,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    system: options.system,
    messages: options.messages,
    schema: {
      type: "object",
      additionalProperties: true,
      description:
        "The JSON output. Return the full structured data as requested in the prompt.",
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
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(encoder.encode(payload));
  }

  function close() {
    if (controller) {
      try {
        controller.close();
      } catch {
        // Already closed
      }
    }
  }

  return { stream, send, close };
}

// ============================================
// Stream with Tool Use (for autonomous agent)
// ============================================

type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

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
  const {
    model = "claude-opus-4-6",
    maxTokens = 16384,
    system,
    messages,
    tools,
    thinking = true,
    thinkingBudget = 16000,
  } = options;

  const useThinking = thinking && model.includes("opus");

  console.log("[claude] streamWithTools model:", model, "messages:", messages.length, "tools:", tools.length, "thinking:", useThinking);

  // Prompt caching: cache_control on the last tool definition caches the
  // entire tool list. System blocks may also carry cache_control. Static
  // prefixes survive 5 min across agent turns, cutting input-token cost ~90%
  // on cache hits.
  const cachedTools =
    tools.length > 0
      ? [
          ...tools.slice(0, -1),
          {
            ...tools[tools.length - 1],
            cache_control: { type: "ephemeral" as const },
          },
        ]
      : tools;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    stream: true,
    messages,
    tools: cachedTools,
  };

  if (system) body.system = system;

  if (useThinking) {
    // Extended thinking: temperature must be 1 (default), budget controls depth
    body.temperature = 1;
    body.thinking = { type: "enabled", budget_tokens: thinkingBudget };
  } else {
    body.temperature = options.temperature ?? 0.7;
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "interleaved-thinking-2025-05-14",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[claude] streamWithTools API error:", response.status, error);

    // Retry on 529 overloaded
    if (response.status === 529) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const waitMs = attempt * 3000;
        console.warn(`[claude] streamWithTools overloaded, waiting ${waitMs / 1000}s (attempt ${attempt}/3)...`);
        await new Promise((r) => setTimeout(r, waitMs));
        // Retry with the same options via recursive call
        const retryRes = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
      "anthropic-beta": "interleaved-thinking-2025-05-14",
          },
          body: JSON.stringify(body),
        });
        if (retryRes.ok) {
          yield* streamWithTools(options);
          return;
        }
        if (retryRes.status !== 529) break;
      }
    }

    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // State tracking for content blocks
  let currentTextBlock = "";
  let currentToolUseId = "";
  let currentToolUseName = "";
  let currentToolUseJson = "";
  let currentThinking = false;
  let currentThinkingText = "";
  let currentThinkingSignature = "";
  let usage: { input_tokens: number; output_tokens: number } | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      const eventType = parsed.type as string;

      switch (eventType) {
        case "content_block_start": {
          const block = parsed.content_block as Record<string, unknown>;
          if (block?.type === "thinking") {
            // Extended thinking block — don't stream content to user
            currentThinking = true;
          } else if (block?.type === "text") {
            currentThinking = false;
            currentTextBlock = "";
          } else if (block?.type === "tool_use") {
            currentThinking = false;
            currentToolUseId = block.id as string;
            currentToolUseName = block.name as string;
            currentToolUseJson = "";
            yield { type: "tool_use_start", id: currentToolUseId, name: currentToolUseName };
          }
          break;
        }

        case "content_block_delta": {
          const delta = parsed.delta as Record<string, unknown>;
          if (currentThinking) {
            if (delta?.type === "thinking_delta") {
              currentThinkingText += (delta.thinking as string) || "";
            } else if (delta?.type === "signature_delta") {
              currentThinkingSignature += (delta.signature as string) || "";
            }
            break;
          }
          if (delta?.type === "text_delta") {
            const text = delta.text as string;
            currentTextBlock += text;
            yield { type: "text_delta", text };
          } else if (delta?.type === "input_json_delta") {
            const partialJson = delta.partial_json as string;
            currentToolUseJson += partialJson;
            yield { type: "tool_use_delta", id: currentToolUseId, partialJson };
          }
          break;
        }

        case "content_block_stop": {
          if (currentThinking) {
            if (currentThinkingText) {
              yield { type: "thinking_done", thinkingText: currentThinkingText, signature: currentThinkingSignature };
            }
            currentThinking = false;
            currentThinkingText = "";
            currentThinkingSignature = "";
            break;
          }
          if (currentTextBlock) {
            yield { type: "text_done", fullText: currentTextBlock };
            currentTextBlock = "";
          }
          if (currentToolUseId) {
            let input: Record<string, unknown> = {};
            try {
              input = JSON.parse(currentToolUseJson);
            } catch {
              console.error("[claude] Failed to parse tool input JSON:", currentToolUseJson.slice(0, 200));
            }
            yield {
              type: "tool_use_done",
              id: currentToolUseId,
              name: currentToolUseName,
              input,
            };
            currentToolUseId = "";
            currentToolUseName = "";
            currentToolUseJson = "";
          }
          break;
        }

        case "message_delta": {
          const delta = parsed.delta as Record<string, unknown>;
          const messageUsage = parsed.usage as Record<string, unknown> | undefined;
          if (messageUsage) {
            usage = {
              input_tokens: (usage?.input_tokens || 0) + ((messageUsage.input_tokens as number) || 0),
              output_tokens: (messageUsage.output_tokens as number) || 0,
            };
          }
          if (delta?.stop_reason) {
            yield {
              type: "message_done",
              stopReason: delta.stop_reason as string,
              usage,
            };
          }
          break;
        }

        case "message_start": {
          const messageUsage = (parsed.message as Record<string, unknown>)?.usage as Record<string, unknown> | undefined;
          if (messageUsage) {
            usage = {
              input_tokens: (messageUsage.input_tokens as number) || 0,
              output_tokens: 0,
            };
          }
          break;
        }
      }
    }
  }
}

export async function* streamText(
  options: ClaudeOptions
): AsyncGenerator<string> {
  const {
    model = "claude-opus-4-6",
    maxTokens = 16384,
    temperature = 0.7,
    system,
    messages,
  } = options;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "interleaved-thinking-2025-05-14",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      ...(system && { system }),
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.text
          ) {
            yield parsed.delta.text;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }
}
