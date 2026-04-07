// Test image/color extraction from HTML
const API_KEY = "fc-f8a8ad46038340768170415763a65f6e";
const url = "https://volund-ventures.com/";

const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url,
    formats: ["html"],
    onlyMainContent: false,
  }),
});

const data = await res.json();
const html = data.data?.html || "";

// Extract images (same logic as firecrawl.ts)
const images = [];
const seen = new Set();

const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
let match;
while ((match = imgRegex.exec(html)) !== null) {
  let src = match[1];
  if (src.startsWith("data:")) continue;
  if (src.startsWith("//")) src = "https:" + src;
  if (!src.startsWith("http")) {
    try { src = new URL(src, url).href; } catch { continue; }
  }
  if (!seen.has(src)) {
    seen.add(src);
    images.push(src);
  }
}

// Extract colors
const colors = new Set();
const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
while ((match = hexRegex.exec(html)) !== null) {
  const hex = match[0].toLowerCase();
  if (!["#fff", "#ffffff", "#000", "#000000", "#333", "#333333", "#666", "#999", "#ccc", "#eee", "#f5f5f5", "#fafafa"].includes(hex)) {
    colors.add(hex);
  }
}

console.log("=== IMAGES ===");
console.log(`Found ${images.length} images:`);
images.forEach((img, i) => console.log(`  ${i + 1}. ${img}`));

console.log("\n=== COLORS ===");
console.log(`Found ${colors.size} colors:`);
[...colors].forEach(c => console.log(`  ${c}`));

// Find logo
const logo = images.find(i => {
  const l = i.toLowerCase();
  return l.includes("logo") || l.includes("brand") || l.includes("icon") || l.includes("favicon");
});
console.log("\n=== LOGO ===");
console.log(logo || "Not found");
