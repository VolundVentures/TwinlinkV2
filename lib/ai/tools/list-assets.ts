import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { buildProjectState, renderProjectStateSection } from "@/lib/ai/project-state";

/**
 * list_assets — refresh the director's view of the project.
 *
 * Useful when the agent is mid-run and needs to confirm what exists — e.g.
 * "do I have @peugeot_emblem yet?" or "how many shots have rendered?".
 * Returns the same markdown manifest that's injected at the top of the
 * system prompt.
 */

export const listAssetsDefinition: ToolDefinition = {
  name: "list_assets",
  description:
    "List every asset generated for the current project — the treatment, every @tag plate, every keyframe, every shot, and the final film if any. Free. Call this if you're unsure which @tags exist or need to verify project state mid-run. (The manifest is also injected into your system prompt at the start of every run, so you usually don't need to call this more than once per session.)",
  input_schema: {
    type: "object",
    properties: {},
  },
};

export const listAssetsTool: ToolHandler = async (_input, context): Promise<ToolResult> => {
  const state = await buildProjectState(context.generationId);
  const md = renderProjectStateSection(state);
  if (!state.hasAny) {
    return {
      success: true,
      content:
        "No assets yet in this generation. Start with write_script to lock the treatment.",
    };
  }
  return {
    success: true,
    content: md,
    data: state,
  };
};
