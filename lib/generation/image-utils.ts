/**
 * Image validation utilities for fal.ai API constraints.
 * Checks dimensions and file size before sending to avoid wasted API calls.
 */

const MIN_DIMENSION = 300; // fal.ai minimum for reference/element images
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type ImageInfo = {
  width: number;
  height: number;
  sizeBytes: number;
  contentType: string;
};

/**
 * Fetch image metadata (dimensions + size) via HEAD request + partial download.
 * Returns null if the image can't be checked (network error, etc).
 */
export async function getImageInfo(url: string): Promise<ImageInfo | null> {
  try {
    // First try HEAD to get file size
    const headRes = await fetch(url, { method: "HEAD" });
    if (!headRes.ok) return null;

    const contentLength = parseInt(headRes.headers.get("content-length") || "0");
    const contentType = headRes.headers.get("content-type") || "image/png";

    // For dimensions, we need to download a small portion
    // PNG: dimensions in first 24 bytes (IHDR chunk)
    // JPEG: dimensions in SOF marker (variable position, need more)
    // For simplicity, download the image and check via a quick decode
    // Only download if size is reasonable (< 20MB)
    if (contentLength > 20 * 1024 * 1024) {
      return { width: 0, height: 0, sizeBytes: contentLength, contentType };
    }

    // Download the full image to check dimensions
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let width = 0;
    let height = 0;

    // PNG: bytes 16-23 contain width and height as 4-byte big-endian integers
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    }
    // JPEG: find SOF0 or SOF2 marker
    else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      for (let i = 2; i < bytes.length - 9; i++) {
        if (bytes[i] === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc2)) {
          height = (bytes[i + 5] << 8) | bytes[i + 6];
          width = (bytes[i + 7] << 8) | bytes[i + 8];
          break;
        }
      }
    }
    // WebP: RIFF header, VP8 chunk contains dimensions
    else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      // Simple VP8: bytes 26-29
      if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
        width = ((bytes[26] | (bytes[27] << 8)) & 0x3fff);
        height = ((bytes[28] | (bytes[29] << 8)) & 0x3fff);
      }
      // VP8L: bytes 21-24
      else if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4c) {
        const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
        width = (bits & 0x3fff) + 1;
        height = ((bits >> 14) & 0x3fff) + 1;
      }
    }

    return {
      width,
      height,
      sizeBytes: buffer.byteLength,
      contentType,
    };
  } catch (err) {
    console.warn("[image-utils] Failed to get image info:", url.slice(0, 60), err);
    return null;
  }
}

/**
 * Validate a list of reference image URLs for fal.ai constraints.
 * Returns only the URLs that pass validation, with warnings for rejected ones.
 */
export async function validateReferenceImages(
  urls: string[],
  options: { minDimension?: number; maxFileSize?: number } = {}
): Promise<{ valid: string[]; warnings: string[] }> {
  const minDim = options.minDimension ?? MIN_DIMENSION;
  const maxSize = options.maxFileSize ?? MAX_FILE_SIZE;
  const valid: string[] = [];
  const warnings: string[] = [];

  for (const url of urls) {
    const info = await getImageInfo(url);

    if (!info) {
      // Can't check — allow it through (fal.ai will validate)
      valid.push(url);
      continue;
    }

    if (info.sizeBytes > maxSize) {
      warnings.push(`Skipped reference image (${(info.sizeBytes / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit): ${url.slice(0, 60)}`);
      continue;
    }

    if (info.width > 0 && info.height > 0 && (info.width < minDim || info.height < minDim)) {
      warnings.push(`Skipped reference image (${info.width}x${info.height} below ${minDim}x${minDim} minimum): ${url.slice(0, 60)}`);
      continue;
    }

    valid.push(url);
  }

  return { valid, warnings };
}
