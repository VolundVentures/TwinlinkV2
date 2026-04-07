// Test the full brand analysis pipeline for wigglie.ma offline (no auth needed)
const FIRECRAWL_KEY = "fc-f8a8ad46038340768170415763a65f6e";

async function scrape(url) {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown", "html", "screenshot", "links"], onlyMainContent: false, waitFor: 3000 }),
  });
  return res.json();
}

console.log("Step 1: Scraping homepage...");
const homepage = await scrape("https://wigglie.ma/en");

const allLinks = homepage.data?.links || [];
const websiteContent = homepage.data?.markdown || "";

console.log("Links found:", allLinks.length);
console.log("Content length:", websiteContent.length);

// Detect e-commerce
const isEcommerce = websiteContent.toLowerCase().includes("shop") ||
  websiteContent.toLowerCase().includes("cart") ||
  websiteContent.toLowerCase().includes("add to") ||
  websiteContent.toLowerCase().includes("price") ||
  websiteContent.toLowerCase().includes("buy") ||
  allLinks.some((l) => /\/(product|shop|store|collection|category|catalog)/i.test(l));

console.log("Is e-commerce:", isEcommerce);

if (isEcommerce) {
  const categoryLinks = allLinks.filter((link) => {
    const l = link.toLowerCase();
    return l.includes("/categor") || l.includes("/collection") || l.includes("/shop/") || l.includes("/products") || l.includes("/catalog");
  });

  console.log("Category links found:", categoryLinks.length);

  const toScrape = categoryLinks.slice(0, 2);
  console.log("Will scrape:", toScrape);

  let fullContent = websiteContent;

  for (const link of toScrape) {
    console.log("\nStep 2: Scraping", link);
    const pageResult = await scrape(link);
    if (pageResult.success && pageResult.data?.markdown) {
      const pageContent = pageResult.data.markdown.slice(0, 4000);
      fullContent += `\n\n--- PAGE: ${link} ---\n${pageContent}`;
      console.log("  Got", pageResult.data.markdown.length, "chars");

      // Check if products are mentioned
      const priceMatches = pageResult.data.markdown.match(/\d+[\.,]\d+\s*(?:dh|MAD|USD|\$|€)/gi);
      console.log("  Price mentions:", priceMatches?.length || 0);
      if (priceMatches) console.log("  Sample prices:", priceMatches.slice(0, 5).join(", "));
    }
  }

  console.log("\nFinal content length:", fullContent.length);
  console.log("Contains product pages:", fullContent.includes("--- PAGE:"));
}
