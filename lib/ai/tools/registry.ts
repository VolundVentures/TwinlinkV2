import { analyzeBrandDefinition, analyzeBrand } from "./analyze-brand";
import { researchCompetitorDefinition, researchCompetitor } from "./research-competitor";
import { generateCreativeBriefDefinition, generateCreativeBrief } from "./generate-creative-brief";
import { generateImageDefinition, generateImageTool } from "./generate-image";
import { generateVideoDefinition, generateVideoTool } from "./generate-video";
import { generateAvatarVideoDefinition, generateAvatarVideoTool } from "./generate-avatar-video";
import { writeScriptDefinition, writeScript } from "./write-script";
import { generateVoiceoverDefinition, generateVoiceoverTool } from "./generate-voiceover";
import { searchTrendsDefinition, searchTrends } from "./search-trends";
import { generateCarouselDefinition, generateCarouselTool } from "./generate-carousel";
import { proposeContentPlanDefinition, proposeContentPlanTool } from "./propose-content-plan";
import { generateCharacterDefinition, generateCharacterTool } from "./generate-character";
import { composeVideoDefinition, composeVideoTool } from "./compose-video";
import { generateMotionGraphicDefinition, generateMotionGraphicTool } from "./generate-motion-graphic";
import { useTemplateDefinition, useTemplateTool } from "./use-template";
import { generateMusicDefinition, generateMusicTool } from "./generate-music";
import { createStoryboardDefinition, createStoryboardTool } from "./create-storyboard";
import { schedulePostDefinition, schedulePostTool } from "./schedule-post";
import { replicateAdDefinition, replicateAdTool } from "./replicate-ad";
import { searchInspirationDefinition, searchInspirationTool } from "./search-inspiration";
import { lipsyncVideoDefinition, lipsyncVideoTool } from "./lipsync-video";
import type { ToolDefinition, ToolHandler } from "./types";

export const TOOL_REGISTRY: Record<string, { definition: ToolDefinition; handler: ToolHandler }> = {
  analyze_brand: { definition: analyzeBrandDefinition, handler: analyzeBrand },
  research_competitor: { definition: researchCompetitorDefinition, handler: researchCompetitor },
  generate_creative_brief: { definition: generateCreativeBriefDefinition, handler: generateCreativeBrief },
  generate_image: { definition: generateImageDefinition, handler: generateImageTool },
  generate_video: { definition: generateVideoDefinition, handler: generateVideoTool },
  generate_avatar_video: { definition: generateAvatarVideoDefinition, handler: generateAvatarVideoTool },
  write_script: { definition: writeScriptDefinition, handler: writeScript },
  generate_voiceover: { definition: generateVoiceoverDefinition, handler: generateVoiceoverTool },
  search_trends: { definition: searchTrendsDefinition, handler: searchTrends },
  generate_carousel: { definition: generateCarouselDefinition, handler: generateCarouselTool },
  propose_content_plan: { definition: proposeContentPlanDefinition, handler: proposeContentPlanTool },
  generate_character: { definition: generateCharacterDefinition, handler: generateCharacterTool },
  compose_video: { definition: composeVideoDefinition, handler: composeVideoTool },
  generate_motion_graphic: { definition: generateMotionGraphicDefinition, handler: generateMotionGraphicTool },
  use_template: { definition: useTemplateDefinition, handler: useTemplateTool },
  generate_music: { definition: generateMusicDefinition, handler: generateMusicTool },
  create_storyboard: { definition: createStoryboardDefinition, handler: createStoryboardTool },
  schedule_post: { definition: schedulePostDefinition, handler: schedulePostTool },
  replicate_ad: { definition: replicateAdDefinition, handler: replicateAdTool },
  search_inspiration: { definition: searchInspirationDefinition, handler: searchInspirationTool },
  lipsync_video: { definition: lipsyncVideoDefinition, handler: lipsyncVideoTool },
};

export function getToolDefinitions(): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).map((t) => t.definition);
}

export function getToolHandler(name: string): ToolHandler | undefined {
  return TOOL_REGISTRY[name]?.handler;
}
