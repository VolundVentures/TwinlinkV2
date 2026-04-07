// Check what's actually stored in the brands table
const BASE = "http://localhost:3000";

const res = await fetch(`${BASE}/api/brands`);
const data = await res.json();

for (const brand of data.brands || []) {
  console.log("=== Brand:", brand.name, "===");
  console.log("ID:", brand.id);
  console.log("logo_url:", brand.logo_url || "NULL");
  console.log("primary_color:", brand.primary_color);
  console.log("scraped_data keys:", Object.keys(brand.scraped_data || {}));

  const sd = brand.scraped_data || {};
  console.log("  images:", Array.isArray(sd.images) ? `${sd.images.length} items` : "MISSING");
  console.log("  screenshot:", sd.screenshot ? "YES" : "MISSING");
  console.log("  favicon:", sd.favicon || "MISSING");
  console.log("  colors:", Array.isArray(sd.colors) ? `${sd.colors.length} items` : "MISSING");
  console.log("  tagline:", sd.tagline || "MISSING");
  console.log("  key_messages:", Array.isArray(sd.key_messages) ? `${sd.key_messages.length} items` : "MISSING");
  console.log();
}
