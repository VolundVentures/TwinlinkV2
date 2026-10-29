import { generateImageDefinition, generateImageTool } from "./generate-image";
import { generatePlateDefinition, generatePlateTool } from "./generate-plate";
import { generateKeyframeDefinition, generateKeyframeTool } from "./generate-keyframe";
import { editPlateDefinition, editPlateTool } from "./edit-plate";
import { generateVideoDefinition, generateVideoTool } from "./generate-video";
import { editVideoDefinition, editVideoTool } from "./edit-video";
import { writeScriptDefinition, writeScript } from "./write-script";
import { generateVoiceoverDefinition, generateVoiceoverTool } from "./generate-voiceover";
import { composeVideoDefinition, composeVideoTool } from "./compose-video";
import { generateMusicDefinition, generateMusicTool } from "./generate-music";
import { generateAmbientDefinition, generateAmbientTool } from "./generate-ambient";
import { requestApprovalDefinition, requestApprovalTool } from "./request-approval";
import { searchReferenceDefinition, searchReferenceTool } from "./search-reference";
import { listAssetsDefinition, listAssetsTool } from "./list-assets";
// Seedance 2.5 video-to-video + 4K finish.
import { generateCoverageDefinition, generateCoverageTool } from "./generate-coverage";
import { applySignaturePassDefinition, applySignaturePassTool } from "./apply-signature-pass";
import { finishFilmDefinition, finishFilmTool } from "./finish-film";
import type { ToolDefinition, ToolHandler } from "./types";

export const TOOL_REGISTRY: Record<string, { definition: ToolDefinition; handler: ToolHandler }> = {
  // ---- Core production pipeline ----
  write_script: { definition: writeScriptDefinition, handler: writeScript },
  generate_plate: { definition: generatePlateDefinition, handler: generatePlateTool },
  edit_plate: { definition: editPlateDefinition, handler: editPlateTool },
  generate_keyframe: { definition: generateKeyframeDefinition, handler: generateKeyframeTool },
  generate_image: { definition: generateImageDefinition, handler: generateImageTool },
  generate_video: { definition: generateVideoDefinition, handler: generateVideoTool },
  edit_video: { definition: editVideoDefinition, handler: editVideoTool },
  generate_music: { definition: generateMusicDefinition, handler: generateMusicTool },
  generate_ambient: { definition: generateAmbientDefinition, handler: generateAmbientTool },
  generate_voiceover: { definition: generateVoiceoverDefinition, handler: generateVoiceoverTool },
  compose_video: { definition: composeVideoDefinition, handler: composeVideoTool },
  search_reference: { definition: searchReferenceDefinition, handler: searchReferenceTool },
  list_assets: { definition: listAssetsDefinition, handler: listAssetsTool },
  request_approval: { definition: requestApprovalDefinition, handler: requestApprovalTool },

  // ---- Seedance 2.5 video-to-video ----
  generate_coverage: { definition: generateCoverageDefinition, handler: generateCoverageTool },
  apply_signature_pass: {
    definition: applySignaturePassDefinition,
    handler: applySignaturePassTool,
  },
  // ---- Finish ----
  finish_film: { definition: finishFilmDefinition, handler: finishFilmTool },
};

export function getToolDefinitions(): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).map((t) => t.definition);
}

export function getToolHandler(name: string): ToolHandler | undefined {
  return TOOL_REGISTRY[name]?.handler;
}
