const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

type ScrapeResult = {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    screenshot?: string;
    metadata?: {
      title?: string;
      description?: string;
      ogImage?: string;
      favicon?: string;
      sourceURL?: string;
      [key: string]: unknown;
    };
    links?: string[];
  };
  error?: string;
};

/**
 * Scrape a URL with Firecrawl. Gets markdown + screenshot + links + HTML for full analysis.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.log("[firecrawl] No API key set, skipping");
    return { success: false, error: "No API key" };
  }

  console.log("[firecrawl] Scraping:", url);

  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html", "screenshot", "links"],
        onlyMainContent: false, // Get FULL page to find logo, nav, footer images
        waitFor: 3000, // Wait for dynamic content to load
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[firecrawl] Error:", response.status, errorText);
      return { success: false, error: `Firecrawl error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    console.log(
      "[firecrawl] Success | markdown:", !!result.data?.markdown,
      "| screenshot:", !!result.data?.screenshot,
      "| links:", result.data?.links?.length || 0,
      "| html length:", result.data?.html?.length || 0
    );
    return result;
  } catch (error) {
    console.error("[firecrawl] Fetch error:", error);
    return { success: false, error: `Firecrawl fetch error: ${error}` };
  }
}

/**
 * Extract all image URLs from HTML content.
 */
export function extractImagesFromHTML(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  // Extract <img src="...">
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = resolveUrl(match[1], baseUrl);
    if (src && !seen.has(src) && isImageUrl(src)) {
      seen.add(src);
      images.push(src);
    }
  }

  // Extract background-image: url(...)
  const bgRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    const src = resolveUrl(match[1], baseUrl);
    if (src && !seen.has(src) && isImageUrl(src)) {
      seen.add(src);
      images.push(src);
    }
  }

  // Extract og:image
  const ogRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  while ((match = ogRegex.exec(html)) !== null) {
    const src = resolveUrl(match[1], baseUrl);
    if (src && !seen.has(src)) {
      seen.add(src);
      images.unshift(src); // OG image is likely the main brand image
    }
  }

  // Extract favicon / apple-touch-icon (likely logo)
  const iconRegex = /<link[^>]+rel=["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/gi;
  while ((match = iconRegex.exec(html)) !== null) {
    const src = resolveUrl(match[1], baseUrl);
    if (src && !seen.has(src)) {
      seen.add(src);
      images.unshift(src); // Icons are likely logo
    }
  }

  return images;
}

/**
 * Extract CSS color values from HTML (inline styles, style tags, CSS variables).
 */
export function extractColorsFromHTML(html: string): string[] {
  const colors = new Set<string>();
  const skipColors = new Set([
    // Neutrals / grays
    "#fff", "#ffffff", "#000", "#000000",
    "#333", "#333333", "#666", "#666666",
    "#999", "#999999", "#ccc", "#cccccc",
    "#eee", "#eeeeee", "#f5f5f5", "#fafafa",
    "#ddd", "#dddddd", "#aaa", "#aaaaaa",
    "#111", "#111111", "#222", "#222222",
    "#444", "#555", "#777", "#888", "#bbb",
    // Social media / third-party widget colors (NOT brand colors)
    "#25d366", // WhatsApp green
    "#128c7e", // WhatsApp dark green
    "#075e54", // WhatsApp teal
    "#1877f2", // Facebook blue
    "#3b5998", // Facebook old blue
    "#1da1f2", // Twitter/X blue
    "#0a66c2", // LinkedIn blue
    "#e4405f", // Instagram gradient pink
    "#c13584", // Instagram purple
    "#ff0000", // YouTube red
    "#ea4335", // Google red
    "#4285f4", // Google blue
    "#34a853", // Google green
    "#fbbc04", // Google yellow
    "#ff4500", // Reddit orange
    "#7289da", // Discord blurple
    "#5865f2", // Discord new blurple
    "#00b900", // LINE green
    "#bd081c", // Pinterest red
    "#ff6900", // Tawk.to orange
    "#635bff", // Stripe purple
    "#003087", // PayPal blue
    "#009cde", // PayPal light blue
    "#00457c", // PayPal dark
  ]);

  let match;

  // Match hex colors (#xxx or #xxxxxx) — from inline styles and <style> blocks
  const hexRegex = /#([0-9a-fA-F]{6})\b/g; // Only 6-char hex for precision
  while ((match = hexRegex.exec(html)) !== null) {
    const hex = match[0].toLowerCase();
    if (!skipColors.has(hex)) {
      colors.add(hex);
    }
  }

  // Match rgb/rgba colors
  const rgbRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi;
  while ((match = rgbRegex.exec(html)) !== null) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    // Skip near-white/black/gray
    if (r === g && g === b) continue; // All grays
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    colors.add(hex);
  }

  // Extract from CSS custom properties (--primary-color: #xxx)
  const cssVarRegex = /--[\w-]+:\s*#([0-9a-fA-F]{6})\b/gi;
  while ((match = cssVarRegex.exec(html)) !== null) {
    colors.add(`#${match[1].toLowerCase()}`);
  }

  return Array.from(colors).slice(0, 20);
}

function resolveUrl(src: string, baseUrl: string): string | null {
  try {
    // Decode HTML entities (&amp; → &, etc.)
    let decoded = src
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');

    if (decoded.startsWith("data:")) return null;
    if (decoded.startsWith("//")) return "https:" + decoded;
    if (decoded.startsWith("http")) return decoded;
    return new URL(decoded, baseUrl).href;
  } catch {
    return null;
  }
}

function isImageUrl(url: string): boolean {
  const lower = url.toLowerCase();

  // Skip known non-brand images
  if (lower.includes("emoji") || lower.includes("tawk.to") || lower.includes("cdn.jsdelivr.net/emoji")) {
    return false;
  }

  // Skip tiny tracking pixels and spacers
  if (lower.includes("1x1") || lower.includes("pixel") || lower.includes("spacer")) {
    return false;
  }

  // Has a known image file extension
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|avif)(\?.*)?$/.test(lower)) {
    return true;
  }

  // Known path patterns that serve images
  if (lower.includes("/_next/image") || lower.includes("/logo") || lower.includes("/img")) {
    return true;
  }

  // CDN URLs that serve images without file extensions
  const cdnPatterns = [
    "cloudinary.com",
    "imgix.net",
    "cdn.shopify.com",
    "images.unsplash.com",
    "res.cloudinary.com",
    "imagedelivery.net",      // Cloudflare Images
    "cdn.sanity.io",
    "images.ctfassets.net",   // Contentful
    "cdn.builder.io",
    "media.graphassets.com",  // Hygraph/GraphCMS
    "assets.vercel.com",
    "lh3.googleusercontent.com",
    "graph.facebook.com",
    "pbs.twimg.com",
    "uploadthing.com",
    "utfs.io",
    "supabase.co/storage",
    "amazonaws.com",
    "googleusercontent.com",
    "fastly.net",
    "akamaized.net",
    "cloudfront.net",
    "b-cdn.net",              // BunnyCDN
  ];

  if (cdnPatterns.some((pattern) => lower.includes(pattern))) {
    return true;
  }

  return false;
}

export async function scrapeUrlFallback(url: string): Promise<string | null> {
  console.log("[jina] Trying fallback for:", url);
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/markdown" },
    });

    if (!response.ok) {
      console.log("[jina] Failed:", response.status);
      return null;
    }

    const text = await response.text();
    console.log("[jina] Success, length:", text.length);
    return text;
  } catch (error) {
    console.error("[jina] Error:", error);
    return null;
  }
}
