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
import { extractFrameDefinition, extractFrameTool } from "./extract-frame";
import { requestApprovalDefinition, requestApprovalTool } from "./request-approval";
import { searchReferenceDefinition, searchReferenceTool } from "./search-reference";
import { listAssetsDefinition, listAssetsTool } from "./list-assets";
// AUTEUR (May 2026) — Aleph trio + teaching surface.
import { generateCoverageDefinition, generateCoverageTool } from "./generate-coverage";
import { applySignaturePassDefinition, applySignaturePassTool } from "./apply-signature-pass";
import { applyDirectorNoteDefinition, applyDirectorNoteTool } from "./apply-director-note";
import { citeLessonDefinition, citeLessonTool } from "./cite-lesson";
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
  extract_frame: { definition: extractFrameDefinition, handler: extractFrameTool },
  compose_video: { definition: composeVideoDefinition, handler: composeVideoTool },
  search_reference: { definition: searchReferenceDefinition, handler: searchReferenceTool },
  list_assets: { definition: listAssetsDefinition, handler: listAssetsTool },
  request_approval: { definition: requestApprovalDefinition, handler: requestApprovalTool },

  // ---- AUTEUR / Runway pipeline (May 2026) ----
  // Aleph's three roles — coverage, signature, surgical edit
  generate_coverage: { definition: generateCoverageDefinition, handler: generateCoverageTool },
  apply_signature_pass: {
    definition: applySignaturePassDefinition,
    handler: applySignaturePassTool,
  },
  apply_director_note: { definition: applyDirectorNoteDefinition, handler: applyDirectorNoteTool },
  // Teaching surface
  cite_lesson: { definition: citeLessonDefinition, handler: citeLessonTool },
};

export function getToolDefinitions(): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).map((t) => t.definition);
}

export function getToolHandler(name: string): ToolHandler | undefined {
  return TOOL_REGISTRY[name]?.handler;
}
