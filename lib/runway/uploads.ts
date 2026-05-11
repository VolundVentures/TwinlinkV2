// Upload helper.
//
// User-uploaded reference images/videos go through Runway's uploads endpoint
// and come back as `runway://` URIs that any task can use without the API
// fetching arbitrary internet URLs (which is a security recommendation in the
// official skill repo). HTTPS URLs from origins we control still work, but
// runway:// URIs are preferred for user-supplied content.

import { getRunwayClient } from "./client";
import { withSlot } from "./rate-limit";

export type UploadResult = {
  /** runway:// URI usable in any image_uri / video_uri / promptImage / promptVideo slot. */
  uri: string;
  /** Underlying upload ID, useful for diagnostics. */
  id: string;
};

/**
 * Upload a file and get back a runway:// URI.
 *
 * The SDK requires the file as a Node ReadableStream / web File / Response /
 * BunFile (per @runwayml/sdk Uploadable type). A raw Buffer is NOT directly
 * accepted — wrap it in a stream or Blob first. The simplest call shape is
 * `fs.createReadStream(path)` for a file on disk.
 *
 * Used by the agent loop's reference upload tool, where users drop files
 * to be referenced in subsequent generations.
 */
export async function uploadEphemeral(
  file: NodeJS.ReadableStream | Blob
): Promise<UploadResult> {
  return withSlot(async () => {
    const client = getRunwayClient();
    // The SDK call shape is `{ file, fileMetadata? }` — passing the file
    // directly trips the SDK's "Unexpected data type: undefined" error.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upload = await (client as any).uploads.createEphemeral({ file });
    return { uri: upload.uri, id: upload.id ?? upload.uri };
  });
}
