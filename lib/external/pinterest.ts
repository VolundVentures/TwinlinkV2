/**
 * Pinterest search via ScrapeCreators API.
 * Used by the search_inspiration tool to find visual references
 * for ad design, product photography, and style inspiration.
 */

const SCRAPECREATORS_BASE = "https://api.scrapecreators.com";

function scrapecreatorHeaders(): Record<string, string> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPECREATORS_API_KEY not set. Add it to your .env file.");
  }
  return {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

export type PinterestPin = {
  title: string;
  description: string;
  image_url: string;
  link?: string;
  board_name?: string;
};

/**
 * Search Pinterest for visual inspiration.
 * Returns image URLs that can be used as reference_image_urls for image generation.
 */
export async function searchPinterest(
  query: string,
  options: { count?: number } = {}
): Promise<PinterestPin[]> {
  const { count = 6 } = options;

  try {
    const params = new URLSearchParams({ query });
    const url = `${SCRAPECREATORS_BASE}/v1/pinterest/search?${params}`;
    console.log("[pinterest] Searching Pinterest:", query);

    const res = await fetch(url, { headers: scrapecreatorHeaders() });

    if (!res.ok) {
      const error = await res.text();
      console.error("[pinterest] ScrapeCreators error:", res.status, error);
      return [];
    }

    const data = await res.json();
    const pins = Array.isArray(data) ? data : data.data || data.pins || data.results || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: PinterestPin[] = pins.slice(0, count).map((pin: any) => {
      // Extract the best image URL from various possible fields
      const imageUrl = (
        pin.image_url ||
        pin.images?.orig?.url ||
        pin.images?.["736x"]?.url ||
        pin.image ||
        pin.thumbnail ||
        pin.media?.images?.orig?.url ||
        ""
      ) as string;

      return {
        title: (pin.title || pin.grid_title || "") as string,
        description: (pin.description || pin.rich_summary?.display_description || "") as string,
        image_url: imageUrl,
        link: (pin.link || pin.url || "") as string,
        board_name: (pin.board?.name || pin.board_name || "") as string,
      };
    }).filter((pin: PinterestPin) => pin.image_url);

    console.log(`[pinterest] Found ${results.length} pins for "${query}"`);
    return results;
  } catch (error) {
    console.error("[pinterest] Search error:", error);
    return [];
  }
}
