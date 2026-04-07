import type { Brand } from "@/lib/database.types";

export function staticAdCreativeBriefPrompt(
  brand: Brand,
  userPrompt: string,
  language: string,
  numVariants: number = 2
): string {
  // Build product context with image URLs for reference-based generation
  const productLines = brand.products?.map((p) => {
    const parts = [p.name, p.description].filter(Boolean).join(": ");
    return p.image_url ? `${parts} [image: ${p.image_url}]` : parts;
  }).join(", ") || "N/A";

  const brandContext = `
Brand: ${brand.name}
Description: ${brand.description || "N/A"}
Industry: ${brand.industry || "N/A"}
Primary Color: ${brand.primary_color || "N/A"}
Secondary Color: ${brand.secondary_color || "N/A"}
Accent Color: ${brand.accent_color || "N/A"}
Brand Voice: ${brand.brand_voice || "professional"}
Target Audience: ${brand.target_audience || "N/A"}
Font: ${brand.font_family || "Helvetica Neue"}
Products: ${productLines}
`;

  const numConcepts = Math.max(1, Math.ceil(numVariants / 2));
  const perConcept = Math.max(1, Math.ceil(numVariants / numConcepts));

  return `You are an elite creative director at a top agency (Wieden+Kennedy, Droga5 level). You study Pinterest boards, Behance, and award-winning campaigns for visual inspiration. Generate a creative brief for ${numVariants} static ad variations for this brand.

${brandContext}

User Request: ${userPrompt || "Create compelling static ads for this brand"}
Target Language: ${language === "ar" ? "Arabic" : "English"}

Generate ${numConcepts} distinct creative concepts, each with ${perConcept} copy/layout variation${perConcept > 1 ? "s" : ""} (${numVariants} total).

CRITICAL — Image prompt guidelines (PHOTOGRAPHY-GRADE, NATURAL-LOOKING AD COMPOSITIONS):
- You are generating FINISHED AD DESIGNS that look like they were shot by a professional photographer and designed by a top agency art director. They must NEVER look AI-generated, stock-photo-perfect, or CGI.
- TEXT RENDERING: Wrap ALL text that should appear in the image in double quotes within the prompt. This is how Nano Banana 2 renders text. Example: "Build the Future" in bold white Helvetica, not: text reading Build the Future
- PROMPT LENGTH: Keep each image_prompt to 60-100 words of natural prose. Do NOT keyword-stuff. Nano Banana 2 uses multimodal reasoning and responds best to conversational descriptions, not Stable Diffusion-style keyword lists.
- Every image prompt MUST describe a complete, ready-to-publish social media ad design with:
  1. HEADLINE TEXT rendered in clean typography as part of the image — use "Clean typography in ${brand.font_family || "Helvetica Neue"}, high contrast against background, professional kerning" (specify font style, size hierarchy, color, and position)
  2. BRAND NAME / LOGO AREA visible in the image (specify placement: top-left, top-center, etc.)
  3. CTA BUTTON or CTA TEXT rendered in the image (specify button color, text, shape, and position)
  4. BODY/SUBTITLE TEXT if applicable (specify font size relative to headline, color, position)
- Use the brand's ACTUAL hex color codes as background colors, accent colors, button colors, and text colors

CAMERA & FILM STOCK (specify for every image prompt):
- Camera: "Shot on Canon EOS R5 with 85mm f/1.4" or "Hasselblad 907X, medium format" or "Sony A7IV with 35mm f/1.8" or "Leica M11 with 50mm Summilux"
- Film stock / color science: "Kodak Portra 400 color palette" or "Fuji Pro 400H tonality" or "Kodak Ektar 100 vivid rendering"
- These specs anchor the image generation toward photorealistic, editorial-quality output

NATURAL IMPERFECTIONS (include in every image prompt):
- "subtle film grain (ISO 400)" or "fine grain characteristic of medium format"
- "natural lens flare from backlight" (when scene has backlighting)
- "slight vignetting at corners"
- "natural skin texture and pores visible" (for any images with people)
- "micro color shifts in shadows" or "slight warmth in highlights"

LIGHTING (use specific cinematographic terms — NEVER say "well-lit"):
- "natural window light at golden hour" or "single softbox key light with negative fill"
- "overcast diffused daylight" or "dappled light through foliage"
- "hard directional sunlight creating defined shadows" or "rim light separating subject from background"
- "practical light from neon signage" or "mixed tungsten and daylight color temperature"

COMPOSITION (editorial, not stock-photo-perfect):
- "off-center subject using rule of thirds" or "negative space on left for text overlay"
- "shallow depth of field with bokeh background" or "slightly asymmetric framing"
- "shot from slightly below eye level" or "candid moment, not posed"
- "environmental context visible — real location, not studio"
- Compositions should feel candid and editorial, like a Vogue or Kinfolk spread

NEGATIVE GUIDANCE (append to EVERY image prompt):
- "NOT stock photography, NOT CGI, NOT oversaturated, NOT HDR look, NOT perfectly symmetrical, NOT studio-perfect, NO uncanny valley"

Reference real photography styles: Annie Leibovitz portraiture, Peter Lindbergh natural beauty, Juergen Teller raw candid, William Eggleston color palette, or Tyler Mitchell warmth — pick whichever matches the brand best.

Example quality target for an image prompt (note double-quoted text for rendering):
"Professional social media ad for a venture building company. Shot on Canon EOS R5 85mm f/1.4, Kodak Portra 400 tones. Golden hour window light from left, subtle film grain, slight vignetting. Off-center rule-of-thirds composition, shallow depth of field. Dark navy (#1a1a2e) background. "Build the Future" in bold white ${brand.font_family || "Helvetica Neue"} upper-right third. "Join Now" on orange (#e94560) rounded CTA button bottom center. ACME logo top-left in small white caps. Kinfolk editorial aesthetic. NOT stock photography, NOT CGI, NOT oversaturated."

Return a JSON object:
{
  "campaign_theme": "Overall campaign theme",
  "mood_board": {
    "visual_territory": "Cinematic Editorial | Warm Lifestyle | Raw UGC | Clean Minimalist | Bright Pop — pick ONE that fits the brand",
    "color_strategy": {
      "primary_usage": "How the primary color (${brand.primary_color || "#000"}) is used — 60% of visual space",
      "accent_usage": "How the accent color (${brand.accent_color || "#000"}) is used — CTAs, highlights, 10%",
      "background": "Background color with hex code"
    },
    "lighting_reference": "Specific lighting description: 'Rembrandt from upper-left, warm 5500K' or 'soft diffused daylight, cool tone'",
    "camera_reference": "Camera + film stock: '85mm f/1.4, Kodak Portra 400' or 'Hasselblad 907X, Fuji Pro 400H'",
    "composition_style": "Rule of thirds | Center dominant | Dynamic diagonal | Negative space dominant",
    "photography_reference": "Reference photographer or publication: 'Annie Leibovitz portraiture' or 'Kinfolk editorial' or 'Tyler Mitchell warmth'"
  },
  "product_reference_urls": ["List any product image URLs from the brand context that should be passed as reference_image_urls during generation"],
  "variants": [
    {
      "variant_number": 1,
      "concept": "Concept name (e.g., 'Editorial Minimalism', 'Lifestyle Aspiration', 'Product Hero')",
      "headline": "Ad headline text${language === "ar" ? " (in Arabic)" : ""}",
      "body": "Ad body/description text${language === "ar" ? " (in Arabic)" : ""}",
      "cta": "Call-to-action text${language === "ar" ? " (in Arabic)" : ""}",
      "visual_direction": "Detailed art direction — layout grid, visual hierarchy, mood board reference, color blocking strategy",
      "image_prompt": "60-100 words of natural prose describing a COMPLETE AD DESIGN. Structure: Subject/product first, then setting, camera, lighting, composition. Wrap ALL rendered text in double quotes. Use brand font ${brand.font_family || "Helvetica Neue"}. Include brand hex colors, natural imperfections (grain, vignetting), photography style reference. End with: NOT stock photography, NOT CGI, NOT oversaturated.",
      "reference_image_urls": ["Any product/character image URLs to pass for consistency — from brand products or previously generated characters"],
      "rationale": "Why this creative approach works for this brand and audience",
      "aspect_ratios": ["1:1", "9:16"]
    }
  ]
}

Make each variant visually distinct — vary the layout structure, color blocking, typography style, and design aesthetic across concepts. Use the brand's hex colors as primary background/accent colors. The headline and CTA text in the image_prompt MUST match the headline and cta fields for that variant. ${language === "ar" ? "All copy must be in Arabic. Text in image prompts must also be in Arabic." : ""} Return ONLY the JSON.`;
}

export function refineCreativeBriefPrompt(
  originalBrief: Record<string, unknown>,
  userFeedback: string,
  language: string
): string {
  return `You are a creative director. The user wants to refine their ad creatives.

Original Creative Brief:
${JSON.stringify(originalBrief, null, 2)}

User Feedback: ${userFeedback}
Language: ${language === "ar" ? "Arabic" : "English"}

Generate an updated creative brief incorporating the user's feedback. Keep the same JSON structure. Only modify the variants affected by the feedback. Return ONLY the JSON.`;
}
