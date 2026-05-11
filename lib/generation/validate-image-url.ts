/**
 * Pre-flight check that a URL actually resolves to an image BEFORE we send
 * it to Replicate as a reference. Catches the #1 failure mode from the
 * field: the agent (or user) paste a webpage URL, a CDN-protected URL, or
 * a URL behind Cloudflare bot-check. Replicate fetches it server-side,
 * gets a 403/HTML, and the prediction fails — burning time and credits.
 *
 * Strategy:
 *   1. HEAD request with a short timeout. If it returns 2xx and a content
 *      type starting with `image/`, we're good.
 *   2. If HEAD is disallowed (405) or returns no content-type, fall back
 *      to a tiny ranged GET (first 512 bytes) to sniff the magic bytes.
 *   3. Supabase/Replicate storage URLs are trusted without a round trip.
 *   4. Never throws — always returns a { ok, reason } so callers can
 *      compose clean agent-visible error messages.
 */

export type UrlValidation = {
  ok: boolean;
  url: string;
  reason?: string;
  contentType?: string;
  status?: number;
};

const TRUSTED_HOSTS = [
  "supabase.co",
  "supabase.in",
  "replicate.delivery",
  "replicate.com",
  "s3.amazonaws.com",
  "cloudfront.net",
];

const IMAGE_MAGIC: Array<{ name: string; bytes: number[] }> = [
  { name: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { name: "jpeg", bytes: [0xff, 0xd8, 0xff] },
  { name: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { name: "webp_riff", bytes: [0x52, 0x49, 0x46, 0x46] },
  { name: "bmp", bytes: [0x42, 0x4d] },
];

function hasImageMagic(bytes: Uint8Array): boolean {
  for (const sig of IMAGE_MAGIC) {
    if (bytes.length < sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (bytes[i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function isTrustedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return TRUSTED_HOSTS.some((t) => host === t || host.endsWith(`.${t}`));
  } catch {
    return false;
  }
}

export async function validateImageUrl(
  url: string,
  opts: { timeoutMs?: number } = {}
): Promise<UrlValidation> {
  const timeoutMs = opts.timeoutMs ?? 8_000;

  if (!url || typeof url !== "string") {
    return { ok: false, url, reason: "empty URL" };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, url, reason: "URL must be http or https" };
  }

  if (isTrustedHost(url)) {
    return { ok: true, url, contentType: "trusted" };
  }

  // Try HEAD first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
      if (res.status >= 400) {
        return {
          ok: false,
          url,
          status: res.status,
          reason: `server returned ${res.status} on HEAD`,
        };
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.startsWith("image/")) {
        return { ok: true, url, contentType: ct, status: res.status };
      }
      // Some CDNs strip content-type on HEAD — fall through to ranged GET
      if (!ct) {
        return await validateViaSniff(url, timeoutMs);
      }
      return {
        ok: false,
        url,
        status: res.status,
        contentType: ct,
        reason: `content-type is "${ct}" — expected image/*. This is probably a webpage link, not a direct image file.`,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Some hosts don't allow HEAD at all — try sniff
    return await validateViaSniff(url, timeoutMs);
  }
}

async function validateViaSniff(url: string, timeoutMs: number): Promise<UrlValidation> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: { Range: "bytes=0-511" },
      });
      if (res.status >= 400) {
        return { ok: false, url, status: res.status, reason: `server returned ${res.status}` };
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.startsWith("image/")) {
        return { ok: true, url, contentType: ct, status: res.status };
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (hasImageMagic(buf)) {
        return { ok: true, url, contentType: ct || "image/unknown", status: res.status };
      }
      return {
        ok: false,
        url,
        status: res.status,
        contentType: ct,
        reason: `content did not begin with an image signature — got content-type "${ct || "<none>"}"`,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      ok: false,
      url,
      reason: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Validate many URLs in parallel; short-circuit returns the whole set.
 */
export async function validateImageUrls(
  urls: string[],
  opts: { timeoutMs?: number } = {}
): Promise<{ ok: boolean; results: UrlValidation[]; bad: UrlValidation[] }> {
  const results = await Promise.all(urls.map((u) => validateImageUrl(u, opts)));
  const bad = results.filter((r) => !r.ok);
  return { ok: bad.length === 0, results, bad };
}
