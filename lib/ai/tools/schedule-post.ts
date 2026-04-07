import type { ToolDefinition, ToolHandler, ToolResult } from "./types";
import { db } from "@/lib/db";

export const schedulePostDefinition: ToolDefinition = {
  name: "schedule_post",
  description:
    "Schedule a generated asset for publishing to a social media platform. Adds the post to the content calendar. The user can then review and publish from the calendar page. Costs 0 credits.",
  input_schema: {
    type: "object",
    properties: {
      asset_url: {
        type: "string",
        description: "URL of the asset to schedule (image or video)",
      },
      platform: {
        type: "string",
        enum: ["instagram", "tiktok", "linkedin", "x", "meta_ads"],
        description: "Target platform",
      },
      scheduled_date: {
        type: "string",
        description: "ISO date string for when to publish (e.g., '2026-03-28T10:00:00Z'). If not provided, schedules for next optimal time.",
      },
      caption: {
        type: "string",
        description: "Post caption/copy",
      },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description: "Hashtags to include",
      },
      post_type: {
        type: "string",
        enum: ["feed", "story", "reel", "carousel"],
        description: "Post format",
      },
    },
    required: ["asset_url", "platform"],
  },
};

export const schedulePostTool: ToolHandler = async (
  input,
  context,
  emitter
): Promise<ToolResult> => {
  const assetUrl = input.asset_url as string;
  const platform = input.platform as string;
  const scheduledDate = (input.scheduled_date as string) || getNextOptimalTime(platform);
  const caption = (input.caption as string) || "";
  const hashtags = (input.hashtags as string[]) || [];
  const postType = (input.post_type as string) || "feed";

  console.log("[tool:schedule_post]", platform, postType, scheduledDate);

  emitter.send("tool_progress", {
    tool: "schedule_post",
    generationId: context.generationId,
    status: "generating",
    message: `Scheduling post to ${platform}...`,
  });

  try {
    const { data: post, error } = await db
      .from("scheduled_posts")
      .insert({
        org_id: context.orgId,
        generation_id: context.generationId,
        platform,
        post_type: postType,
        content: caption,
        media_urls: [assetUrl],
        hashtags,
        scheduled_for: scheduledDate,
        status: "scheduled",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[tool:schedule_post] Error:", error.message);
      return { success: false, content: `Failed to schedule post: ${error.message}` };
    }

    emitter.send("tool_progress", {
      tool: "schedule_post",
      generationId: context.generationId,
      status: "complete",
      message: "Post scheduled successfully",
    });

    const date = new Date(scheduledDate);
    const dateStr = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

    return {
      success: true,
      content: `Post scheduled to ${platform} for ${dateStr}.\nFormat: ${postType}\nCaption: ${caption.slice(0, 100)}${caption.length > 100 ? "..." : ""}\n\nThe post is visible on the Content Calendar and can be published when ready.`,
      data: { postId: post?.id, platform, scheduledDate, postType },
    };
  } catch (error) {
    return {
      success: false,
      content: `Failed to schedule: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

function getNextOptimalTime(platform: string): string {
  const now = new Date();
  // Default to tomorrow at 10am
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(10, 0, 0, 0);

  // Platform-specific optimal times
  switch (platform) {
    case "instagram": next.setHours(11, 0, 0, 0); break; // 11am
    case "tiktok": next.setHours(19, 0, 0, 0); break; // 7pm
    case "linkedin": next.setHours(8, 30, 0, 0); break; // 8:30am
    case "x": next.setHours(9, 0, 0, 0); break; // 9am
  }

  return next.toISOString();
}
