// Test the full brand analyze flow end-to-end
const BASE = "http://localhost:3000";

console.log("Testing brand analysis for volund-ventures.com...\n");

const res = await fetch(`${BASE}/api/brands/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://volund-ventures.com/" }),
});

console.log("Status:", res.status);
const data = await res.json();

if (data.error) {
  console.log("ERROR:", data.error);
  process.exit(1);
}

console.log("\n=== BRAND ===");
console.log("Name:", data.brand?.name);
console.log("Colors:", data.brand?.primary_color, data.brand?.secondary_color, data.brand?.accent_color);
console.log("Products:", data.brand?.products?.length);

console.log("\n=== ASSETS ===");
console.log("assets key exists:", !!data.assets);
if (data.assets) {
  console.log("Screenshot:", data.assets.screenshot ? "YES" : "NO");
  console.log("Logo:", data.assets.logo || "NOT FOUND");
  console.log("Favicon:", data.assets.favicon || "NOT FOUND");
  console.log("OG Image:", data.assets.ogImage || "NOT FOUND");
  console.log("Images count:", data.assets.images?.length || 0);
  console.log("Colors count:", data.assets.colors?.length || 0);

  if (data.assets.images?.length > 0) {
    console.log("\nFirst 5 images:");
    data.assets.images.slice(0, 5).forEach((img, i) => console.log(`  ${i+1}. ${img}`));
  }
  if (data.assets.colors?.length > 0) {
    console.log("\nColors:", data.assets.colors.join(", "));
  }
} else {
  console.log("NO ASSETS IN RESPONSE - this is the bug!");
  console.log("\nFull response keys:", Object.keys(data));
  console.log("Full response:", JSON.stringify(data).slice(0, 1000));
}
