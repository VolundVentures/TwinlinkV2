import type { ToolDefinition, ToolHandler, ToolResult } from "./types";

// The director pauses production here. The tool emits a `checkpoint_ready`
// event the frontend listens for, and the agent-loop uses the presence of
// this call to stop the turn after execution. The user's next follow-up
// message (approve / edit / regenerate) resumes the loop.

export const requestApprovalDefinition: ToolDefinition = {
  name: "request_approval",
  description:
    "Pause production and request the user's approval at a checkpoint. This is how you gate the film's stages — call this tool at each of the 5 mandatory checkpoints:\n\n" +
    "1. `treatment` — after writing the treatment, before any tool calls.\n" +
    "2. `plates` — after all core plates are generated.\n" +
    "3. `keyframes` — after per-shot keyframes (Layer 2) are generated, before Seedance/Veo runs any shot video.\n" +
    "4. `shots` — after all shot videos are generated, before compose_video.\n" +
    "5. `final_cut` — after the composed film, as a quality gate.\n\n" +
    "**Behaviour:** calling this tool ENDS your current turn. The user will reply with natural-language feedback (`approve`, or `change X`, or `re-shoot plate @hero`). Read their reply and respond accordingly — regenerate only the specific items they flag, or proceed to the next stage.\n\n" +
    "Costs 0 credits.",
  input_schema: {
    type: "object",
    properties: {
      stage: {
        type: "string",
        enum: ["treatment", "plates", "keyframes", "shots", "final_cut"],
        description: "Which stage of the film you are presenting for approval.",
      },
      summary: {
        type: "string",
        description:
          "Short summary of what is ready for review. Written as a director briefing, not a tech report. For `treatment`: the logline + tone. For `plates`: what plates were made. For `keyframes`: for each shot, what keyframes were made. For `shots`: the full shot list with durations. For `final_cut`: the total runtime + grade + music direction used.",
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            asset_id: { type: "string", description: "Asset ID from generation_assets if applicable." },
            ref: { type: "string", description: "Stable reference the user can name in feedback — e.g. `@hero_character`, `shot_3`, `shot_3_kf1`, `final_film`." },
            label: { type: "string", description: "Short label shown in the UI." },
            kind: { type: "string", description: "plate | keyframe | shot | final." },
          },
          required: ["ref", "label", "kind"],
        },
        description:
          "The concrete items the user can react to. E.g. for plates: `[{ref:'@hero', label:'Hero character', kind:'plate'}, ...]`. For keyframes: one entry per keyframe. For shots: one entry per shot. This drives the approval UI.",
      },
    },
    required: ["stage", "summary", "items"],
  },
};

export const requestApprovalTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const stage = input.stage as string;
  const summary = input.summary as string;
  const items = (input.items as Array<Record<string, string>>) || [];

  emitter.send("checkpoint_ready", {
    generationId: context.generationId,
    stage,
    summary,
    items,
  });

  return {
    success: true,
    // Explicit instruction to Claude: stop here. The loop will also force-break.
    content: `Checkpoint reached: ${stage}. ${items.length} item(s) presented to the user. END YOUR TURN NOW. Do not call any more tools. Wait for the user's next message — they will either approve, or describe specific changes. When they reply, act only on their instructions: approve-and-continue, or regenerate only the specific items they flagged.`,
  };
};
