import type { ToolDefinition, ToolHandler, ToolResult } from "./types";

/**
 * search_reference — find real-world reference images on the web via Firecrawl.
 *
 * Use case: the user asks for "the new Peugeot emblem" but doesn't upload it.
 * Instead of the agent hallucinating, it calls this tool, we search the web
 * with Firecrawl, scrape the top pages, and return actual image URLs the
 * agent can then pass to generate_plate as reference_image_urls.
 *
 * Requires FIRECRAWL_API_KEY. Falls back to a clean error if absent.
 */

type FirecrawlSearchResponse = {
  success?: boolean;
  data?: Array<{
    url: string;
    title?: string;
    description?: string;
    markdown?: string;
    html?: string;
  }>;
};

type ImageCandidate = {
  url: string;
  sourcePage: string;
  sourceTitle?: string;
  alt?: string;
};

const IMG_TAG_RE = /<img[^>]+src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?/gi;
const IMG_EXT_RE = /\.(jpe?g|png|webp|avif)(?:\?.*)?$/i;

function isPlausibleImage(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:")) return false;
  // Reject tracking pixels / tiny UI gfx
  if (/sprite|icon|favicon|1x1|pixel|tracking|avatar|badge|emoji/i.test(src)) return false;
  // Accept URLs ending in a real image extension OR big CDN hosts
  return (
    IMG_EXT_RE.test(src) ||
    /wikimedia|wikipedia|cloudfront|akamaized|imgix|cdn\./i.test(src)
  );
}

function resolveUrl(src: string, base: string): string | null {
  try {
    if (src.startsWith("//")) return "https:" + src;
    if (src.startsWith("http")) return src;
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

function extractImagesFromHtml(html: string, baseUrl: string): Array<{ url: string; alt?: string }> {
  const out: Array<{ url: string; alt?: string }> = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  IMG_TAG_RE.lastIndex = 0;
  while ((m = IMG_TAG_RE.exec(html)) !== null) {
    const resolved = resolveUrl(m[1], baseUrl);
    if (!resolved) continue;
    if (!isPlausibleImage(resolved)) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push({ url: resolved, alt: m[2] });
    if (out.length >= 12) break;
  }
  return out;
}

export const searchReferenceDefinition: ToolDefinition = {
  name: "search_reference",
  description:
    "Search the web for real reference images (logos, emblems, products, locations, real actors). Returns image URL candidates pulled from the top web results. Use when the user mentions a specific real-world thing (a brand emblem, a real product, a specific place) you'd otherwise have to hallucinate.\n\n" +
    "After picking the best candidate, pass its URL as `reference_image_urls` in `generate_plate` so Nano Banana edits from the real image instead of inventing one.\n\n" +
    "Costs 1 credit.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Be specific: '2021 Peugeot lion emblem grille badge', '2023 Porsche 911 GT3 front view', 'Eleven Madison Park dining room interior'. Usually add the year and angle you want.",
      },
      max_candidates: {
        type: "number",
        description: "Max image URLs to return (1–12). Default 8.",
      },
    },
    required: ["query"],
  },
};

export const searchReferenceTool: ToolHandler = async (input) => {
  const query = (input.query as string)?.trim();
  const maxCandidates = Math.min(12, Math.max(1, (input.max_candidates as number) || 8));

  if (!query) {
    return { success: false, content: "search_reference requires a `query`." };
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      content:
        "search_reference is not configured — set FIRECRAWL_API_KEY in .env. In the meantime, ask the user to upload a reference image in the brief panel or paste a direct image URL in chat.",
    };
  }

  try {
    // Firecrawl /v1/search — returns top web results with scraped HTML.
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 3,
        scrapeOptions: { formats: ["html"], onlyMainContent: false },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        content: `Firecrawl search error ${res.status}: ${errText.slice(0, 300)}`,
      };
    }

    const data: FirecrawlSearchResponse = await res.json();
    const pages = data.data || [];
    if (pages.length === 0) {
      return {
        success: false,
        content: `No web results for "${query}". Try a more specific query or ask the user to upload a reference.`,
      };
    }

    // Extract images from every result page's HTML.
    const candidates: ImageCandidate[] = [];
    for (const p of pages) {
      if (!p.html) continue;
      const imgs = extractImagesFromHtml(p.html, p.url);
      for (const i of imgs) {
        candidates.push({
          url: i.url,
          sourcePage: p.url,
          sourceTitle: p.title,
          alt: i.alt,
        });
        if (candidates.length >= maxCandidates * 2) break;
      }
      if (candidates.length >= maxCandidates * 2) break;
    }

    if (candidates.length === 0) {
      return {
        success: false,
        content: `Found ${pages.length} pages for "${query}" but couldn't extract any plausible images. Top page URLs: ${pages.map((p) => p.url).slice(0, 3).join(", ")}. Ask the user to paste a direct image URL.`,
      };
    }

    // De-dup by URL and cap
    const seen = new Set<string>();
    const final: ImageCandidate[] = [];
    for (const c of candidates) {
      if (seen.has(c.url)) continue;
      seen.add(c.url);
      final.push(c);
      if (final.length >= maxCandidates) break;
    }

    const formatted = final
      .map(
        (c, i) =>
          `${i + 1}. ${c.alt ? `"${c.alt}"` : c.sourceTitle || "(untitled)"}\n   image: ${c.url}\n   source: ${c.sourcePage}`
      )
      .join("\n");

    return {
      success: true,
      content: `Found ${final.length} reference candidates for "${query}":\n\n${formatted}\n\nPick the best match and pass its URL as reference_image_urls in generate_plate.`,
      data: { query, candidates: final },
    };
  } catch (error) {
    return {
      success: false,
      content: `search_reference failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};
