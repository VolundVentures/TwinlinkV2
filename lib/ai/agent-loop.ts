import {
  streamWithTools,
  type AnthropicMessage,
  type ContentBlock,
  type ToolUseBlock,
} from "@/lib/ai/claude";
import type {
  AgentContext,
  ToolResult,
  SSEEmitter as SSEEmitterShape,
} from "@/lib/ai/tools/types";
import { TOOL_CREDIT_COSTS, TOOL_TIMEOUTS } from "@/lib/ai/tools/types";
import { SSEEmitter } from "@/lib/ai/sse-emitter";
import { getCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-system-prompt";
import { getToolDefinitions, getToolHandler } from "@/lib/ai/tools/registry";

const MAX_TURNS = 30;
const MAX_TOOL_CALLS = 60;

/**
 * Core autonomous agent loop.
 *
 * Streams Claude responses to the frontend via SSE while executing tools
 * in a multi-turn conversation until the agent decides it is done or
 * safety limits are reached.
 */
export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function runAgentLoop(
  context: AgentContext,
  userPrompt: string,
  emitter: SSEEmitter,
  sessionId: string,
  conversationHistory?: ConversationMessage[]
): Promise<void> {
  // Build messages: previous conversation history + current user prompt
  const messages: AnthropicMessage[] = [];

  // Inject previous conversation so the agent remembers what was discussed
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    console.log(`[agent-loop] Loaded ${conversationHistory.length} previous messages for context`);
  }

  // Add the current user message
  messages.push({ role: "user", content: userPrompt });

  const toolDefs = getToolDefinitions();
  const systemPrompt = buildAgentSystemPrompt(context.brand, context.language, context.allBrands);

  let totalToolCalls = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(
      `[agent-loop] Turn ${turn + 1}/${MAX_TURNS}, tool calls so far: ${totalToolCalls}`
    );

    // ----- Stream one Claude response -----
    let assistantContentBlocks: ContentBlock[];
    let stopReason: string;

    try {
      const result = await collectStreamResponse(
        systemPrompt,
        messages,
        toolDefs,
        emitter
      );
      assistantContentBlocks = result.contentBlocks;
      stopReason = result.stopReason;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[agent-loop] Claude API error:", errMsg);
      emitter.send("error", { message: `AI error: ${errMsg}` });
      break;
    }

    // Add the assistant message to the conversation
    messages.push({
      role: "assistant",
      content: assistantContentBlocks,
    });

    // ----- Collect tool_use blocks -----
    const toolUseBlocks = assistantContentBlocks.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );

    // If no tool calls and stop_reason is "end_turn", the agent is done
    if (toolUseBlocks.length === 0 && stopReason === "end_turn") {
      console.log("[agent-loop] Agent finished (end_turn, no tool calls)");
      break;
    }

    // If there are no tool calls but stop_reason isn't end_turn
    // (e.g. max_tokens), also break to avoid infinite loop
    if (toolUseBlocks.length === 0) {
      console.log(`[agent-loop] No tool calls, stop_reason: ${stopReason}`);
      break;
    }

    // ----- Execute tool calls -----
    if (totalToolCalls + toolUseBlocks.length > MAX_TOOL_CALLS) {
      emitter.send("agent_message", {
        content:
          "I've reached the maximum number of tool calls for this session. Here's a summary of what was accomplished so far.",
      });
      break;
    }

    // Budget check: estimate cost of upcoming tool calls
    if (context.budget && context.budget > 0) {
      const currentCredits = await getCredits(context.orgId);
      const estimatedCost = toolUseBlocks.reduce((sum, block) => {
        return sum + (TOOL_CREDIT_COSTS[block.name] || 5);
      }, 0);

      if (currentCredits < estimatedCost) {
        emitter.send("agent_message", {
          content: `Not enough credits for the next steps. You have ${currentCredits} credits but need ~${estimatedCost}. Please upgrade your plan to continue.`,
        });
        emitter.send("budget_exceeded", { remaining: currentCredits, needed: estimatedCost });
        break;
      }

      // Send budget update to frontend
      emitter.send("credits_update", {
        remaining: currentCredits,
        estimatedCost,
        budgetCap: context.budget,
      });
    }

    const toolResultBlocks = await executeToolCalls(
      toolUseBlocks,
      context,
      emitter
    );

    totalToolCalls += toolUseBlocks.length;

    // Add tool results as a user message (Anthropic format)
    messages.push({
      role: "user",
      content: toolResultBlocks,
    });

    // Persist step progress to DB (best-effort)
    try {
      await db
        .from("agent_sessions")
        .update({
          current_step: turn + 1,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch {
      // Non-critical — don't break the loop
    }
  }

  // If we exhausted all turns without the agent finishing
  if (totalToolCalls >= MAX_TOOL_CALLS) {
    emitter.send("agent_message", {
      content:
        "Reached the maximum number of tool executions. Stopping here — please review the results above.",
    });
  }
}

// ============================================
// Stream collection
// ============================================

type StreamResult = {
  contentBlocks: ContentBlock[];
  stopReason: string;
};

/**
 * Calls streamWithTools and collects the full response, emitting
 * real-time SSE events to the frontend along the way.
 */
async function collectStreamResponse(
  systemPrompt: string,
  messages: AnthropicMessage[],
  tools: ReturnType<typeof getToolDefinitions>,
  emitter: SSEEmitter
): Promise<StreamResult> {
  const contentBlocks: ContentBlock[] = [];
  let stopReason = "end_turn";

  // Track text block being assembled
  let currentText = "";

  const stream = streamWithTools({
    system: systemPrompt,
    messages,
    tools,
  });

  for await (const event of stream) {
    switch (event.type) {
      case "thinking_done": {
        // Include thinking block with signature in content for API conversation history
        // (required by Anthropic — thinking blocks + signature must be preserved)
        contentBlocks.push({ type: "thinking", thinking: event.thinkingText, signature: event.signature });
        console.log(`[agent-loop] Thinking: ${event.thinkingText.length} chars`);
        break;
      }

      case "text_delta": {
        currentText += event.text;
        emitter.send("thinking", { text: event.text });
        break;
      }

      case "text_done": {
        if (event.fullText) {
          contentBlocks.push({ type: "text", text: event.fullText });
          emitter.send("agent_message", { content: event.fullText });
        }
        currentText = "";
        break;
      }

      case "tool_use_start": {
        emitter.send("tool_start", {
          toolCallId: event.id,
          toolName: event.name,
        });
        break;
      }

      case "tool_use_done": {
        const block: ToolUseBlock = {
          type: "tool_use",
          id: event.id,
          name: event.name,
          input: event.input,
        };
        contentBlocks.push(block);
        break;
      }

      case "message_done": {
        stopReason = event.stopReason;
        break;
      }
    }
  }

  // Handle edge case: text was streaming but text_done never fired
  if (currentText && !contentBlocks.some((b) => b.type === "text")) {
    contentBlocks.push({ type: "text", text: currentText });
    emitter.send("agent_message", { content: currentText });
  }

  return { contentBlocks, stopReason };
}

// ============================================
// Tool execution
// ============================================

/**
 * Execute all tool calls from a single assistant turn.
 * Runs them in parallel when there are multiple.
 */
async function executeToolCalls(
  toolUseBlocks: ToolUseBlock[],
  context: AgentContext,
  emitter: SSEEmitter
): Promise<ContentBlock[]> {
  const results = await Promise.all(
    toolUseBlocks.map((block) => executeToolCall(block, context, emitter))
  );

  return results;
}

/**
 * Execute a single tool call with credit checking, timeout, and error handling.
 * Returns a tool_result content block for the conversation.
 */
async function executeToolCall(
  block: ToolUseBlock,
  context: AgentContext,
  emitter: SSEEmitter
): Promise<ContentBlock> {
  const { id, name, input } = block;

  console.log(`[agent-loop] Executing tool: ${name} (id: ${id})`);

  // ----- Credit check -----
  const creditCost = TOOL_CREDIT_COSTS[name] ?? 0;
  if (creditCost > 0) {
    try {
      const balance = await getCredits(context.orgId);
      if (balance < creditCost) {
        const errorMsg = `Insufficient credits. Tool "${name}" costs ${creditCost} credits but you have ${balance}. Please purchase more credits to continue.`;
        emitter.send("tool_result", {
          toolCallId: id,
          toolName: name,
          success: false,
          content: errorMsg,
        });
        return {
          type: "tool_result",
          tool_use_id: id,
          content: errorMsg,
          is_error: true,
        };
      }
    } catch (err) {
      console.error(`[agent-loop] Credit check failed for ${name}:`, err);
      // Non-fatal — proceed with tool execution
    }
  }

  // ----- Get handler -----
  const handler = getToolHandler(name);
  if (!handler) {
    const errorMsg = `Unknown tool: "${name}". This tool is not available.`;
    emitter.send("tool_result", {
      toolCallId: id,
      toolName: name,
      success: false,
      content: errorMsg,
    });
    return {
      type: "tool_result",
      tool_use_id: id,
      content: errorMsg,
      is_error: true,
    };
  }

  // ----- Execute with timeout -----
  const timeoutMs = TOOL_TIMEOUTS[name] ?? 60_000;

  let result: ToolResult;
  try {
    result = await withTimeout(
      (signal) => handler(input, { ...context, signal }, emitter as unknown as SSEEmitterShape),
      timeoutMs,
      `Tool "${name}" timed out after ${Math.round(timeoutMs / 1000)}s`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[agent-loop] Tool "${name}" failed:`, errMsg);

    emitter.send("tool_result", {
      toolCallId: id,
      toolName: name,
      success: false,
      content: errMsg,
    });

    return {
      type: "tool_result",
      tool_use_id: id,
      content: `Tool execution failed: ${errMsg}`,
      is_error: true,
    };
  }

  // ----- Deduct credits on success -----
  if (result.success && creditCost > 0) {
    try {
      const balance = await getCredits(context.orgId);
      const newBalance = balance - creditCost;
      await db
        .from("credit_balances")
        .update({ balance: newBalance })
        .eq("org_id", context.orgId);

      await db.from("credit_transactions").insert({
        org_id: context.orgId,
        amount: -creditCost,
        type: "deduction",
        description: `Tool: ${name} (generation: ${context.generationId})`,
        balance_after: newBalance,
      });

      emitter.send("credits_deducted", {
        tool: name,
        cost: creditCost,
        balance: newBalance,
      });
    } catch (err) {
      console.error(`[agent-loop] Credit deduction failed for ${name}:`, err);
      // Non-fatal — the tool already succeeded
    }
  }

  // ----- Emit result + assets -----
  emitter.send("tool_result", {
    toolCallId: id,
    toolName: name,
    success: result.success,
    content: result.content,
  });

  // Emit asset_ready events for any produced assets
  if (result.assets && result.assets.length > 0) {
    for (const asset of result.assets) {
      emitter.send("asset_ready", {
        assetId: asset.assetId,
        type: asset.type,
        url: asset.url,
        metadata: asset.metadata,
      });
    }
  }

  return {
    type: "tool_result",
    tool_use_id: id,
    content: result.content,
    is_error: !result.success,
  };
}

// ============================================
// Utilities
// ============================================

function withTimeout<T>(
  promiseOrFactory: Promise<T> | ((signal: AbortSignal) => Promise<T>),
  ms: number,
  message: string
): Promise<T> {
  const controller = new AbortController();
  const promise =
    typeof promiseOrFactory === "function"
      ? promiseOrFactory(controller.signal)
      : promiseOrFactory;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(message));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
