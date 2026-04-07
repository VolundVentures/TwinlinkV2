// Test what Firecrawl actually returns
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
    formats: ["markdown", "html", "screenshot", "links"],
    onlyMainContent: false,
    waitFor: 3000,
  }),
});

const data = await res.json();
console.log("Status:", res.status);
console.log("Success:", data.success);
if (data.data) {
  console.log("Has markdown:", !!data.data.markdown, "length:", data.data.markdown?.length);
  console.log("Has html:", !!data.data.html, "length:", data.data.html?.length);
  console.log("Has screenshot:", !!data.data.screenshot);
  console.log("Links count:", data.data.links?.length);
  console.log("Metadata keys:", Object.keys(data.data.metadata || {}));
  console.log("Metadata:", JSON.stringify(data.data.metadata || {}).slice(0, 800));

  if (data.data.html) {
    const imgMatches = data.data.html.match(/<img[^>]+src=["'][^"']+["']/gi);
    console.log("\nImages found in HTML:", imgMatches?.length || 0);
    if (imgMatches) {
      imgMatches.slice(0, 10).forEach((m, i) => console.log(`  img ${i + 1}:`, m.slice(0, 120)));
    }
  }

  if (data.data.markdown) {
    // Find markdown image refs
    const mdImages = data.data.markdown.match(/!\[.*?\]\(.*?\)/g);
    console.log("\nImages in markdown:", mdImages?.length || 0);
    if (mdImages) {
      mdImages.slice(0, 10).forEach((m, i) => console.log(`  md ${i + 1}:`, m.slice(0, 120)));
    }
  }
} else {
  console.log("No data returned");
  console.log("Error:", data.error);
  console.log("Full response:", JSON.stringify(data).slice(0, 500));
}
