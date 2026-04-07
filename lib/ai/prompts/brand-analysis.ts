export function brandAnalysisPrompt(
  websiteContent: string,
  url: string
): string {
  return `You are a senior brand strategist. Analyze the following website content and extract a comprehensive brand profile.

Website URL: ${url}

Website Content (includes extracted CSS colors, images, and metadata):
${websiteContent}

Extract and return a JSON object:
{
  "name": "Brand name (exact, as displayed on the website)",
  "description": "2-3 sentence brand description focusing on what they do and their value proposition",
  "industry": "Primary industry/category",
  "primary_color": "#hex — MUST be from the EXTRACTED CSS COLORS section if available. Pick the most prominent non-white, non-black brand color.",
  "secondary_color": "#hex — second most prominent brand color from the extracted CSS colors",
  "accent_color": "#hex — accent/CTA color from the extracted CSS colors (often used for buttons, links)",
  "brand_voice": "formal|casual|playful|authoritative|inspirational",
  "target_audience": "Description of their target audience based on the website messaging",
  "products": [
    {
      "name": "SPECIFIC product or service name (e.g. 'iPhone 16 Pro', 'Growth Accelerator Program', 'Premium Subscription')",
      "description": "Brief description of this specific product/service",
      "type": "product|service",
      "price": "Price if shown on the website, null otherwise",
      "image_url": "URL of the product image if found in the IMAGES list, null otherwise"
    }
  ],
  "tagline": "Brand tagline if found on the website, null otherwise",
  "key_messages": ["Key marketing message 1", "Key marketing message 2"],
  "visual_style": "minimalist|bold|photography-heavy|illustration|dark-moody|bright-clean",
  "competitors": ["Competitor Name 1", "Competitor Name 2"],
  "social_links": {"instagram": "url or null", "tiktok": "url or null", "linkedin": "url or null"}
}

CRITICAL RULES:
- For COLORS: Look at the attached screenshot of the website. Identify the 2-3 primary brand colors from the visual design (header, navigation, hero section, primary buttons). Ignore colors from third-party widgets (WhatsApp buttons, social media icons, chat widgets, payment buttons). If a theme-color meta tag is provided, treat it as a high-confidence signal for the primary brand color. You MUST always provide hex color values — NEVER return null for colors.
- For PRODUCTS: Extract SPECIFIC, NAMED products or services that a customer can actually buy or sign up for.
  - E-COMMERCE: Extract individual products with their exact names, prices, and image URLs. Example: "Ownat Natural Dog Food 3kg" at "$25.99", NOT "Dog Food" (too generic).
  - SERVICE BUSINESS: Extract specific named programs/offerings. Example: "Growth Accelerator Program", NOT "Venture Building" (too generic).
  - If the website only shows broad categories (like "Beds & Blankets", "Leashes & Collars"), those are CATEGORIES, not products. Check if there are "--- PAGE:" sections with actual product listings and extract from there instead.
  - If no specific products found, return "products": [].
- If a field cannot be determined from the content, use null — EXCEPT for colors (always provide a hex value).
- The brand name must be EXACTLY as it appears on the website (correct capitalization, spelling).
- Extract social media links from the page (Instagram, TikTok, LinkedIn, Twitter/X). Extract visual style based on the website's design aesthetic.
- Return ONLY the JSON object.`;
}

export function brandAnalysisFromKnowledgePrompt(
  brandName: string,
  url: string
): string {
  return `You are a brand strategist. Based on your training knowledge, provide a brand profile for "${brandName}" (${url}).

IMPORTANT: The website could not be scraped. Work from general knowledge only.
- Only include products/services you are CONFIDENT this brand actually offers.
- If unsure about specific products, return "products": []
- Mark any uncertain fields as null.

Return a JSON object:
{
  "name": "${brandName}",
  "description": "2-3 sentence brand description",
  "industry": "Primary industry",
  "primary_color": "#hex (best guess based on known brand or industry)",
  "secondary_color": "#hex",
  "accent_color": "#hex",
  "brand_voice": "formal|casual|playful|authoritative|inspirational",
  "target_audience": "Target audience description",
  "products": [{"name": "...", "description": "...", "type": "product|service"}],
  "tagline": "Tagline if known, null otherwise",
  "key_messages": ["Key message 1"],
  "visual_style": "minimalist|bold|photography-heavy|illustration|dark-moody|bright-clean",
  "competitors": ["Competitor Name 1", "Competitor Name 2"],
  "social_links": {"instagram": "url or null", "tiktok": "url or null", "linkedin": "url or null"}
}

Return ONLY the JSON object.`;
}
