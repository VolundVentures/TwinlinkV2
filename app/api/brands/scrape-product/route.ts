import { NextResponse } from "next/server";
import { scrapeUrl, scrapeUrlFallback, extractImagesFromHTML } from "@/lib/external/firecrawl";
import { generateJSON } from "@/lib/ai/claude";

/**
 * Scrape a single product page and extract structured product data.
 * POST /api/brands/scrape-product
 * Body: { url: string }
 */
export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log("[scrape-product] Scraping:", url);

    let content: string | null = null;
    let images: string[] = [];

    // Scrape the product page
    try {
      const result = await scrapeUrl(url);
      if (result.success && result.data) {
        content = result.data.markdown || null;
        if (result.data.html) {
          images = extractImagesFromHTML(result.data.html, url);
        }
      }
    } catch {
      // Fallback to Jina
      content = await scrapeUrlFallback(url);
    }

    if (!content) {
      return NextResponse.json({ error: "Failed to scrape the product page" }, { status: 422 });
    }

    // Extract product data with Claude
    const product = await generateJSON<{
      name: string;
      description: string;
      price: string | null;
      type: string;
      image_url: string | null;
    }>({
      model: "claude-sonnet-4-6",
      maxTokens: 1024,
      system: "Extract product information from this webpage. Return valid JSON only.",
      messages: [{
        role: "user",
        content: `Extract the main product from this page.

Page content:
${content.slice(0, 5000)}

Images found on page:
${images.slice(0, 10).join("\n")}

Return JSON:
{
  "name": "Exact product name",
  "description": "Product description (1-2 sentences)",
  "price": "Price with currency, or null if not found",
  "type": "product",
  "image_url": "URL of the main product image from the images list, or null"
}`,
      }],
    });

    // If Claude didn't pick an image, use the first large image
    if (!product.image_url && images.length > 0) {
      product.image_url = images.find((img) => {
        const l = img.toLowerCase();
        return !l.includes("icon") && !l.includes("logo") && !l.includes("favicon");
      }) || images[0];
    }

    console.log("[scrape-product] Extracted:", product.name);

    return NextResponse.json({ product, images: images.slice(0, 10) });
  } catch (error) {
    console.error("[scrape-product] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scrape product" },
      { status: 500 }
    );
  }
}
