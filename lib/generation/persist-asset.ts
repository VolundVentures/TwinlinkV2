import { db } from "@/lib/db";

/**
 * Mirror a Replicate (or other ephemeral) URL to Supabase Storage so the
 * asset survives after the provider's delivery URL expires (~24h for
 * replicate.delivery).
 *
 * Returns the persistent Supabase public URL. On failure, returns the
 * original URL so the pipeline doesn't break — the caller can decide whether
 * to treat that as fatal.
 */
export async function persistAsset(
  sourceUrl: string,
  opts: {
    generationId: string;
    kind: "image" | "video" | "audio";
    basename?: string;
  }
): Promise<string> {
  if (!sourceUrl || !sourceUrl.startsWith("http")) return sourceUrl;

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.warn(
        `[persist-asset] fetch ${sourceUrl.slice(0, 80)} → ${res.status}; keeping source URL`
      );
      return sourceUrl;
    }

    const contentType =
      res.headers.get("content-type") ||
      (opts.kind === "video" ? "video/mp4" : opts.kind === "audio" ? "audio/mpeg" : "image/png");

    const ext = pickExt(sourceUrl, contentType, opts.kind);
    const filename = opts.basename
      ? `${slug(opts.basename)}-${Date.now().toString(36)}.${ext}`
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `generations/${opts.generationId}/${filename}`;

    await db.storage.createBucket("assets", { public: true }).catch(() => {});

    const buf = await res.arrayBuffer();
    const { error: upErr } = await db.storage
      .from("assets")
      .upload(path, buf, { contentType, upsert: true });
    if (upErr) {
      console.warn(`[persist-asset] upload failed: ${upErr.message}; keeping source URL`);
      return sourceUrl;
    }

    const { data } = db.storage.from("assets").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn(
      `[persist-asset] error mirroring ${sourceUrl.slice(0, 80)}:`,
      err instanceof Error ? err.message : err
    );
    return sourceUrl;
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function pickExt(url: string, contentType: string, kind: "image" | "video" | "audio"): string {
  const urlExt = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (urlExt && /^[a-z0-9]{2,5}$/.test(urlExt) && urlExt.length <= 5) {
    if (["png", "jpg", "jpeg", "webp", "gif", "mp4", "mov", "webm", "mp3", "wav", "m4a"].includes(urlExt)) {
      return urlExt;
    }
  }
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("mpeg") && kind === "audio") return "mp3";
  if (contentType.includes("wav")) return "wav";
  return kind === "video" ? "mp4" : kind === "audio" ? "mp3" : "png";
}
