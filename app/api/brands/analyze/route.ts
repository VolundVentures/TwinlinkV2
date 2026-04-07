import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai/claude";
import type { ClaudeContentBlock } from "@/lib/ai/claude";
import {
  scrapeUrl,
  scrapeUrlFallback,
  extractImagesFromHTML,
  extractColorsFromHTML,
} from "@/lib/external/firecrawl";
import {
  brandAnalysisPrompt,
  brandAnalysisFromKnowledgePrompt,
} from "@/lib/ai/prompts/brand-analysis";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log("[brand-analysis] Analyzing:", url);

    let websiteContent: string | null = null;
    let html: string | null = null;
    let screenshotUrl: string | null = null;
    let scrapedImages: string[] = [];
    let scrapedColors: string[] = [];
    let metadata: Record<string, unknown> = {};
    let allLinks: string[] = [];

    // Try Firecrawl first (gets markdown + HTML + screenshot + links)
    try {
      const scrapeResult = await scrapeUrl(url);
      if (scrapeResult.success && scrapeResult.data) {
        websiteContent = scrapeResult.data.markdown || null;
        html = scrapeResult.data.html || null;
        screenshotUrl = scrapeResult.data.screenshot || null;
        metadata = scrapeResult.data.metadata || {};
        allLinks = scrapeResult.data.links || [];

        // Extract images from HTML
        if (html) {
          scrapedImages = extractImagesFromHTML(html, url);
          scrapedColors = extractColorsFromHTML(html);
          console.log(
            "[brand-analysis] Extracted",
            scrapedImages.length,
            "images,",
            scrapedColors.length,
            "colors from HTML"
          );
        }

        console.log(
          "[brand-analysis] Firecrawl success | content:",
          websiteContent?.length || 0,
          "| screenshot:", !!screenshotUrl,
          "| images:", scrapedImages.length
        );
      }
    } catch (e) {
      console.log("[brand-analysis] Firecrawl failed:", e);
    }

    // Second pass: detect e-commerce and scrape product/category pages
    if (allLinks.length > 0 && websiteContent) {
      const baseDomain = new URL(url).hostname;

      // Detect if this is an e-commerce site
      const isEcommerce = websiteContent.toLowerCase().includes("shop") ||
        websiteContent.toLowerCase().includes("cart") ||
        websiteContent.toLowerCase().includes("add to") ||
        websiteContent.toLowerCase().includes("price") ||
        websiteContent.toLowerCase().includes("buy") ||
        allLinks.some((l) => /\/(product|shop|store|collection|category|catalog)/i.test(l));

      if (isEcommerce) {
        // Find category/collection pages (to get actual product listings)
        const categoryLinks = allLinks.filter((link) => {
          const l = link.toLowerCase();
          return (
            l.includes("/categor") ||
            l.includes("/collection") ||
            l.includes("/shop/") ||
            l.includes("/products") ||
            l.includes("/catalog")
          );
        });

        // Find individual product pages
        const productLinks = allLinks.filter((link) => {
          const l = link.toLowerCase();
          return (
            l.includes("/product/") ||
            l.includes("/item/") ||
            l.includes("/p/") ||
            // Shopify/WooCommerce patterns
            (l.includes("/products/") && !l.endsWith("/products/") && !l.endsWith("/products"))
          );
        });

        // Scrape: prioritize category pages (they list multiple products), then individual products
        const toScrape = [
          ...categoryLinks.slice(0, 2), // Up to 2 category pages
          ...productLinks.slice(0, 3),  // Up to 3 product pages
        ].slice(0, 4); // Max 4 total extra scrapes

        if (toScrape.length > 0) {
          console.log("[brand-analysis] E-commerce detected. Scraping", toScrape.length, "additional pages");

          for (const link of toScrape) {
            try {
              const fullUrl = link.startsWith("http") ? link : new URL(link, url).href;
              // Skip external links
              if (!new URL(fullUrl).hostname.includes(baseDomain.replace("www.", ""))) continue;

              const pageResult = await scrapeUrl(fullUrl);
              if (pageResult.success && pageResult.data?.markdown) {
                websiteContent += `\n\n--- PAGE: ${fullUrl} ---\n${pageResult.data.markdown.slice(0, 4000)}`;
                console.log("[brand-analysis] Scraped:", fullUrl.slice(0, 80));

                if (pageResult.data.html) {
                  const pageImages = extractImagesFromHTML(pageResult.data.html, fullUrl);
                  scrapedImages.push(...pageImages);
                }
              }
            } catch (e) {
              console.log("[brand-analysis] Failed to scrape:", e);
            }
          }
        } else {
          console.log("[brand-analysis] E-commerce detected but no category/product links found in:", allLinks.length, "links");
        }
      }
    }

    // Fallback to Jina Reader
    if (!websiteContent) {
      try {
        websiteContent = await scrapeUrlFallback(url);
        if (websiteContent) {
          console.log("[brand-analysis] Jina fallback success, length:", websiteContent.length);
        }
      } catch (e) {
        console.log("[brand-analysis] Jina fallback failed:", e);
      }
    }

    // Extract theme-color meta tag from HTML (high-confidence brand color signal)
    let themeColor: string | null = null;
    if (html) {
      const themeColorMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["']/i);
      if (themeColorMatch) {
        themeColor = themeColorMatch[1];
        console.log("[brand-analysis] Found theme-color meta tag:", themeColor);
      }
    }

    // Build enhanced prompt with all extracted data
    let prompt: string;
    if (websiteContent) {
      // Put product/category page content FIRST (it has the actual products)
      // then homepage content (has brand info but products are just categories)
      const parts = websiteContent.split("--- PAGE:");
      const homepage = parts[0];
      const subPages = parts.slice(1).map((p) => "--- PAGE:" + p);

      // Prioritize sub-pages (have actual products) over homepage (has categories)
      let enhancedContent = "";
      if (subPages.length > 0) {
        enhancedContent += "=== PRODUCT LISTING PAGES (extract products from here) ===\n";
        enhancedContent += subPages.join("\n").slice(0, 12000);
        enhancedContent += "\n\n=== HOMEPAGE (extract brand info from here) ===\n";
        enhancedContent += homepage.slice(0, 6000);
      } else {
        enhancedContent = homepage.slice(0, 16000);
      }

      if (themeColor) {
        enhancedContent += `\n\n--- THEME-COLOR META TAG (high-confidence brand color) ---\n${themeColor}`;
      }

      if (scrapedImages.length > 0) {
        enhancedContent += `\n\n--- IMAGES FOUND ON WEBSITE ---\n${scrapedImages.slice(0, 30).join("\n")}`;
      }

      if (metadata.ogImage) {
        enhancedContent += `\n\n--- OG IMAGE ---\n${metadata.ogImage}`;
      }

      if (metadata.favicon) {
        enhancedContent += `\n\n--- FAVICON ---\n${metadata.favicon}`;
      }

      prompt = brandAnalysisPrompt(enhancedContent, url);
    } else {
      console.log("[brand-analysis] Using Claude knowledge fallback");
      const brandName = new URL(url).hostname.replace("www.", "").split(".")[0];
      prompt = brandAnalysisFromKnowledgePrompt(brandName, url);
    }

    // Build message content: text prompt + screenshot image (if available)
    let messageContent: string | ClaudeContentBlock[];
    if (screenshotUrl) {
      messageContent = [
        { type: "image" as const, source: { type: "url" as const, url: screenshotUrl } },
        { type: "text" as const, text: prompt },
      ];
      console.log("[brand-analysis] Including screenshot in Claude Vision call:", screenshotUrl.slice(0, 80));
    } else {
      messageContent = prompt;
    }

    const brand = await generateJSON<{
      name: string;
      description: string;
      industry: string;
      primary_color: string | null;
      secondary_color: string | null;
      accent_color: string | null;
      brand_voice: string;
      target_audience: string;
      products: Array<{ name: string; description: string; type: string; price?: string | null; image_url?: string | null }>;
      tagline: string | null;
      key_messages: string[];
    }>({
      model: "claude-opus-4-6",
      messages: [{ role: "user", content: messageContent }],
      system: "You are a brand analyst AI. Always respond with valid JSON only.",
    });

    // If Claude still returned null colors, set reasonable defaults
    if (!brand.primary_color) {
      brand.primary_color = "#1a1a2e";
      brand.secondary_color = "#e2e2e2";
      brand.accent_color = "#0066ff";
      console.log("[brand-analysis] No colors found, using defaults");
    }

    console.log(
      "[brand-analysis] Final colors:", brand.primary_color, brand.secondary_color, brand.accent_color,
      "| CSS extracted:", scrapedColors.length
    );

    // Build the response with all scraped assets
    const response = {
      brand,
      scraped: !!websiteContent,
      assets: {
        screenshot: screenshotUrl,
        images: [...new Set(scrapedImages)].slice(0, 30), // Top 30 unique images
        logo: findLogo(scrapedImages, url, { favicon: metadata.favicon as string | undefined, ogImage: metadata.ogImage as string | undefined, html: html || undefined, hasScreenshot: !!screenshotUrl }),
        favicon: metadata.favicon || null,
        ogImage: metadata.ogImage || null,
        colors: scrapedColors,
      },
      metadata: {
        title: metadata.title || null,
        description: metadata.description || null,
        linkCount: allLinks.length,
      },
    };

    console.log(
      "[brand-analysis] Done:", brand.name,
      "| images:", scrapedImages.length,
      "| logo:", response.assets.logo ? "found" : "not found"
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("[brand-analysis] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Brand analysis failed" },
      { status: 500 }
    );
  }
}

/**
 * Helper: resolve a URL from HTML against a base URL.
 */
function resolveUrl(src: string, baseUrl: string): string | null {
  try {
    const decoded = src.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    if (decoded.startsWith("data:")) return null;
    if (decoded.startsWith("//")) return "https:" + decoded;
    if (decoded.startsWith("http")) return decoded;
    return new URL(decoded, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Check if a URL looks like an image (has extension or is from a known image CDN).
 */
function looksLikeImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|avif)(\?.*)?$/i.test(lower)) return true;
  const cdnPatterns = [
    "cloudinary.com", "imgix.net", "cdn.shopify.com", "images.unsplash.com",
    "res.cloudinary.com", "imagedelivery.net", "cdn.sanity.io", "images.ctfassets.net",
    "cdn.builder.io", "media.graphassets.com", "assets.vercel.com",
    "lh3.googleusercontent.com", "uploadthing.com", "utfs.io",
    "supabase.co/storage", "amazonaws.com", "cloudfront.net", "b-cdn.net",
    "fastly.net", "akamaized.net",
  ];
  return cdnPatterns.some((p) => lower.includes(p));
}

/**
 * Extract images from <header> and <nav> elements in HTML — these are almost always logos.
 */
function extractHeaderNavImages(html: string, baseUrl: string): string[] {
  const results: string[] = [];
  const blockRegex = /<(header|nav)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[2];
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(block)) !== null) {
      const src = resolveUrl(imgMatch[1], baseUrl);
      if (src && (looksLikeImageUrl(src) || src.toLowerCase().includes("logo"))) {
        results.push(src);
      }
    }
  }
  return results;
}

/**
 * Extract high-quality SVG icon from <link rel="icon" type="image/svg+xml">.
 */
function extractSvgIcon(html: string, baseUrl: string): string | null {
  const patterns = [
    /<link[^>]+rel=["']icon["'][^>]+type=["']image\/svg\+xml["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']icon["'][^>]+type=["']image\/svg\+xml["']/i,
    /<link[^>]+type=["']image\/svg\+xml["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const regex of patterns) {
    const match = regex.exec(html);
    if (match) return resolveUrl(match[1], baseUrl);
  }
  return null;
}

/**
 * Extract apple-touch-icon URL from HTML.
 */
function extractAppleTouchIcon(html: string, baseUrl: string): string | null {
  const patterns = [
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i,
  ];
  for (const regex of patterns) {
    const match = regex.exec(html);
    if (match) return resolveUrl(match[1], baseUrl);
  }
  return null;
}

/**
 * Heuristic to find the logo from extracted images.
 * Prefers: "logo" in path > header/nav images > SVG icon > apple-touch-icon > og:image > favicon
 */
function findLogo(
  images: string[],
  baseUrl: string,
  metadata?: { favicon?: string; ogImage?: string; html?: string; hasScreenshot?: boolean },
): string | null {
  // Pass 1: find images with "logo" in the path (prefer larger variants)
  const logoImages = images.filter((img) => {
    const lower = img.toLowerCase();
    return lower.includes("logo") && !lower.includes("icon-sm") && !lower.includes("-sm.");
  });

  if (logoImages.length > 0) {
    const sorted = logoImages.sort((a, b) => {
      const aIsSvg = a.toLowerCase().endsWith(".svg") ? 1 : 0;
      const bIsSvg = b.toLowerCase().endsWith(".svg") ? 1 : 0;
      if (aIsSvg !== bIsSvg) return bIsSvg - aIsSvg;
      const wA = parseInt(a.match(/w=(\d+)/)?.[1] || "0");
      const wB = parseInt(b.match(/w=(\d+)/)?.[1] || "0");
      return wB - wA;
    });
    return sorted[0];
  }

  // Pass 2: images inside <header> or <nav> (almost always logos)
  if (metadata?.html) {
    const headerNavImages = extractHeaderNavImages(metadata.html, baseUrl);
    if (headerNavImages.length > 0) {
      const sorted = headerNavImages.sort((a, b) => {
        const aIsSvg = a.toLowerCase().endsWith(".svg") ? 1 : 0;
        const bIsSvg = b.toLowerCase().endsWith(".svg") ? 1 : 0;
        return bIsSvg - aIsSvg;
      });
      return sorted[0];
    }
  }

  // Pass 3: SVGs in the image list (often logos)
  for (const img of images) {
    if (img.toLowerCase().endsWith(".svg") && !img.includes("emoji") && !img.includes("tawk")) {
      return img;
    }
  }

  // Pass 4: <link rel="icon" type="image/svg+xml"> — high-quality vector icon
  if (metadata?.html) {
    const svgIcon = extractSvgIcon(metadata.html, baseUrl);
    if (svgIcon) return svgIcon;
  }

  // Pass 5: apple-touch-icon (usually 180x180 clean logo)
  if (metadata?.html) {
    const appleTouchIcon = extractAppleTouchIcon(metadata.html, baseUrl);
    if (appleTouchIcon) return appleTouchIcon;
  }
  for (const img of images) {
    if (img.toLowerCase().includes("apple-touch-icon")) {
      return img;
    }
  }

  // Pass 6: "brand" or "icon" images (larger ones)
  for (const img of images) {
    const lower = img.toLowerCase();
    if ((lower.includes("brand") || lower.includes("icon")) && !lower.includes("emoji")) {
      return img;
    }
  }

  // Pass 7: og:image — when Firecrawl provided a screenshot, og:image is likely a brand/logo image
  if (metadata?.ogImage) {
    return metadata.ogImage;
  }

  // Pass 8: favicon (last resort — may be small but better than nothing)
  if (metadata?.favicon && !metadata.favicon.includes("data:")) {
    return metadata.favicon;
  }

  // Pass 9: first same-domain image (likely header/hero)
  const domain = new URL(baseUrl).hostname;
  for (const img of images.slice(0, 5)) {
    try {
      if (new URL(img).hostname.includes(domain.replace("www.", ""))) {
        return img;
      }
    } catch { continue; }
  }

  return null;
}
