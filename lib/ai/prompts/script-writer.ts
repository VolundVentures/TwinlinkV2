import type { Brand } from "@/lib/database.types";

export function videoScriptPrompt(
  brand: Brand,
  userPrompt: string,
  language: string,
  durationSeconds: number = 30
): string {
  const productLines = brand.products
    ?.map((p) => {
      const parts = [p.name, p.description].filter(Boolean).join(": ");
      return p.image_url ? `${parts} [image_url: ${p.image_url}]` : parts;
    })
    .join("\n  - ") || "N/A";

  const brandContext = `
Brand: ${brand.name}
Industry: ${brand.industry || "N/A"}
Voice: ${brand.brand_voice || "casual"}
Audience: ${brand.target_audience || "N/A"}
Products:
  - ${productLines}
`;

  const maxWords = Math.floor(durationSeconds * 2.5);
  const minWords = Math.max(25, Math.floor(durationSeconds * 1.5));

  return `You are a world-class creative director. You think in IMAGES and FEELINGS. Every shot you write is a frame you can see in your mind.

${brandContext}

Brief: ${userPrompt || "Create a video ad"}
Language: ${language === "ar" ? "Arabic (natural dialect, NOT formal broadcast)" : language === "fr" ? "French (natural, conversational)" : "English (natural, conversational)"}
Duration: ${durationSeconds} seconds
Voiceover: minimum ${minWords} words, maximum ${maxWords} words (must cover at least 60% of video — 14 seconds of VO for a 30s video is UNACCEPTABLE)

---

## Emotional Mechanics

### Tension → Release (plan at least ONE cycle)
- VISUAL: tight framing + speed build → wide reveal + slow-motion hold
- AUDIO: rising rhythm + faster speech → silence + bass drop + whisper
- NARRATIVE: problem/question/mystery → answer/product/transformation

### Counterpoint (voice ≠ image — together they create meaning)
- Voice: "some mornings feel different" / Image: headlights igniting in pre-dawn darkness → DESIRE
- Voice: "I was this close to shutting down" / Image: laptop with low sales dashboard → EMPATHY
- Voice: nothing (silence) / Image: hands opening product box, sound of rain → INTIMACY

### Rhythm-to-Emotion in Voiceover
- Short. Punchy. Fragments. = urgency, energy, confidence
- Long, flowing sentences that unfurl like silk across the frame. = luxury, contemplation, desire
- Mix both: build tension with short → release with long. Or vice versa.
- Pauses matter. A beat of silence before "...and that changed everything" makes it hit.

### Brand-Voice Mutation (same concept, different energy)
The SAME idea should sound completely different for different brands:
- Luxury car: "Some mornings, the road feels like it was made just for you."
- Energy drink: "5:47am. The city's still asleep. You're not."
- Skincare: "That first touch. Cool glass against warm skin. You already know."
- SaaS: "Tuesday. 3pm. Your pipeline just updated itself. You didn't touch it."
- Fashion: "She didn't buy the dress. She became someone who wears it."

Write the voiceover in THIS brand's voice. Not generic ad copy.

---

## Visual World-Building (don't default to "product in dark void")

Choose the world that serves THIS brand's story:

- **Environmental**: Product in its natural habitat. Coffee machine on marble counter, morning light through shutters. Car on wet mountain road at golden hour. The PLACE tells the story.
- **Narrative**: A mini-story. Someone reaching for the product. First use. Satisfaction after. Beginning → middle → end.
- **Human-Centric**: Hands, silhouettes, over-shoulder. The human RELATIONSHIP with the product without showing faces. Intimate, tactile.
- **Abstract/Artistic**: Color fields, light play, extreme macro textures. Product becomes art.
- **Dynamic/Kinetic**: Product in motion — spinning, falling, assembling, transforming. Physics and energy.
- **Contextual Contrast**: Product in unexpected place. Luxury headphones on construction site. Running shoes on boardroom table. The contrast IS the story.
- **Dark Studio Void**: ONLY when it genuinely serves the brand — tech reveals, deconstructed engineering, dramatic hero shots. Not the default.

---

## Voiceover Rules

**For Product Hero / Cinematic ads:**
- Write like a human THINKS, not like a copywriter writes
- Short sentences. Fragments are good. Rhythm matters more than grammar.
- Specific details > generic claims: "the 3.2 second rush" not "incredible speed"
- Leave GAPS — silence is powerful. Not every second needs words.
- For aggressive/sports: voiceover can be minimal or absent — let music and SFX carry it

**For UGC Testimonial (DIFFERENT rules — TikTok yapping energy):**
- Each talking section MUST have 18-22 words of dialogue to fill the full 8s clip
- Write like someone ranting to their phone camera — natural, flowing, emotional
- Use filler words: "okay so", "honestly", "like", "I'm not even kidding", "look"
- Long sentences that build: start a thought, add detail, build emotion, land the point
- Each section is a STORY CHUNK, not a one-liner
- **BAD**: "I love this product." (wastes 7 seconds of silence in the clip)
- **GOOD**: "Okay so I've been using this for like two weeks now and honestly I wasn't expecting much but my skin has literally never looked this good, like my friends are actually asking me what I changed" (fills 8s naturally)
- The ENERGY should build across clips: clip 1 = confession/hook, clip 2 = the turn/discovery, clip 3 = the payoff/result

BANNED for ALL types: "introducing", "discover", "experience", "elevate", "revolutionize", "game-changer", "premium quality", "unlike anything", "designed for", "crafted for"

---

## Shot Description Rules

Each shot must be a SPECIFIC IMAGE a cinematographer could frame:
- BAD: "Show the product in a nice setting"
- GOOD: "Extreme macro of condensation trails on frosted glass, warm backlight creating golden halo, rack focus pull to the label"

Include:
- Camera distance (extreme close-up, close-up, medium, wide)
- Camera movement (static, push-in, orbital, dolly, handheld drift)
- Lighting (golden hour, Rembrandt, rim light, neon, natural window)
- One texture detail (reflections, condensation, fabric weave, dust particles)
- For UGC: iPhone selfie aesthetic, natural light, casual environment

---

## Camera Motion (Seedance 2.0 — the PRIMARY video model for products)

Seedance understands timestamped multi-phase motion, speed ramps, and scene transitions within a single clip. Each clip is one CONTINUOUS camera journey.

### Format: Camera simulation header → timestamped phases

**Speed guide:** 20-40% = dramatic slow-motion | 50-80% = deliberate, cinematic | 100% = real-time | 120-200% = energetic

### EXAMPLES (vary the camera system — NOT always IMAX + Panavision):

**A. Cinematic Orbital Reveal** (Cooke Anamorphic S7, 50mm):
\`\`\`
Camera simulation: Cooke Anamorphic S7, 50mm. Horizontal lens flares from polished chrome. Strong film grain.
00:00-00:03 Speed 40%. Extreme macro on chrome badge. Rack focus pull. Rim light traces lettering. Cool blue tone.
00:03-00:07 Speed ramps to 120%. Slow orbital sweep 45° revealing front quarter. Reflections shift on wet floor.
00:07-00:10 Speed drops to 60%. Camera settles on hero three-quarter angle. Light shifts cool blue to warm gold. Hold.
\`\`\`

**B. The Toss — Outdoor to Studio** (65mm IMAX, ultra-wide Panavision):
\`\`\`
Camera simulation: 65mm IMAX film, ultra-wide Panavision anamorphic. Strong film grain. Bright sunlight from camera-left. Scene transitions to dark studio with cool blue rim light.
Single continuous 7-second shot. No cuts.

00:00-00:01 · The Toss — Hand releases product against bright blue sky. Spins slowly, catching sunlight. Speed 50%.
00:01-00:02.5 · Macro Detail — Speed 140%. Camera spirals in tight clockwise orbit. Cool light glides across warm body, revealing matte textures.
00:02.5-00:04 · Side Profile — Speed 35%. Camera curves along slim edge. Reflections roll along metallic frame.
00:04-00:05.5 · Hero Build — Speed 120%. Camera sweeps under bottom edge, rises into three-quarter. Lens flares streak across trim.
00:05.5-00:07 · The Reveal — Speed 20%. Classic three-quarter. Golden light washes from right. Every material reads clearly. Hold.
\`\`\`

**C. Environmental Storytelling** (Canon EOS R5, 85mm f/1.4):
\`\`\`
Camera simulation: Canon EOS R5, 85mm f/1.4. Shallow depth of field. Kodak Portra 400 warmth. Natural window light from camera-left.
00:00-00:03 Speed 50%. Product resting on worn marble countertop. Steam from coffee cup drifts past. Morning light catches surface.
00:03-00:06 Speed 80%. Gentle push-in. Hands enter frame from right, fingers making contact with product. Tactile interaction.
00:06-00:08 Speed 40%. Camera continues push-in to extreme close-up of detail. Background blooms into warm bokeh. Hold.
\`\`\`

**D. Deconstructed Engineering** (65mm IMAX, macro-capable):
\`\`\`
Camera simulation: 65mm IMAX, macro-capable Panavision anamorphic. Strong film grain. Warm-neutral key light from above. Deep black void.
Single continuous shot. Product explodes and reassembles.

00:00-00:01 · Float — Product rotating slowly in void. Thin white light. Stillness. Speed 50%.
00:01-00:03 · Fly-Through — Speed 180%. Product erupts apart. Camera accelerates into cloud. Passes circuit traces, textures, cables.
00:03-00:04 · Turn — Speed 40%. Smooth 180° whip turn. Component highlights streak into motion blur.
00:04-00:06 · Rebuild — Speed 200%. Every component reverses inward. Mechanical precision. Speed drops to 30% for final snap.
00:06-00:07 · Hold — Speed 20%. Classic three-quarter. Screen glows. Hold.
\`\`\`

**E. Warm Lifestyle** (Fuji X-T5, 23mm f/2):
\`\`\`
Camera simulation: Fuji X-T5, 23mm f/2. Fuji Pro 400H tonality. Golden hour backlight. Slight lens flare from direct sun.
00:00-00:03 Speed 60%. Wide establishing shot. Person in background, product in foreground on table. Golden light wraps everything.
00:03-00:06 Speed 80%. Gentle dolly right. Person reaches for product. Rack focus from background to product in hand.
00:06-00:08 Speed 50%. Medium close-up. Product held up against light. Translucent edges glow. Warm. Hold.
\`\`\`

**F. Aggressive Sports** (RED Komodo, 16mm wide):
\`\`\`
Camera simulation: RED Komodo, 16mm ultra-wide. High contrast. Deep black, saturated accent colors. Scanline textures, chromatic aberration. Every cut synced to bass hits.

00:00-01:00 · Logo — Emissive logo on black. Neon pulse. Glitch flash out.
01:00-02:00 · Hero Shot — Product floating in studio. HUD overlays, wireframe boxes. Bold uppercase type.
02:00-03:00 · Macro — Extreme close-up. Chromatic aberration, bloom, floating particles.
03:00-04:00 · Kinetic Type — Full-screen words scrolling at varying speeds.
04:00-05:00 · Tracking — Speed-ramped tracking shot. Glowing accents sweep frame.
05:00-06:00 · Silhouette — High-contrast product silhouette. Expanding shockwave. Bass sync.
06:00-07:00 · End — Static logo. Clean glow. Impact note. Fade.
\`\`\`

### Kling Fallback (if Seedance fails)
ONE camera move per clip, 2-3 sentences, NO timestamps:
"Slow clockwise orbital sweep 45 degrees. Rim light traces shoulder line. Chrome reflections shift. Product rigid."

---

## Style Library

- **Editorial Minimal**: Marble surface, serif headlines, muted palette. "Kinfolk magazine"
- **UGC Raw**: iPhone quality, messy desk, candid. "iPhone 15 Pro screenshot"
- **Bold Pop**: Saturated, geometric, chunky sans-serif. "Memphis design, bright yellow"
- **Dark Premium**: Deep blacks, rim lighting, metallic. "Hasselblad medium format"
- **Lifestyle Warm**: Golden hour, earthy tones. "Kodak Portra 400, lived-in space"
- **Aggressive Sports**: High contrast, scanlines, HUD elements. "Nike Football meets Blade Runner UI"
- **Deconstructed Tech**: Exploded views, floating components. "iFixit teardown meets sci-fi"
- **Film Noir**: Extreme shadows, venetian blind light. "Roger Deakins, Blade Runner 2049"
- **Retro Analog**: VHS grain, CRT scanlines, 80s palette. "Stranger Things"
- **Architectural**: Leading lines, symmetry. "Wes Anderson meets Tadao Ando"

Combine, subvert, or invent new ones.

---

## Hook Types (vary these — never repeat)
1. **Curiosity**: "This ad ran 72 hours before we turned it off"
2. **Social Proof**: "Used by 4,200 marketers" + notification cascade
3. **Pain-Point**: "Still chasing leads that never reply?"
4. **Identity**: "If you're a founder who hates selling..."
5. **Contrarian**: "Most productivity apps waste your time"
6. **Transformation**: Before/after morph transition
7. **Numbers**: "4.27x ROAS" + animated stat
8. **Humor**: Relatable truthful humor, meme-adjacent
9. **Pattern Break**: Visual disruption in first frame
10. **POV**: "POV: you just discovered..."

---

## JSON Output Format

{
  "title": "Short evocative working title",
  "duration_seconds": ${durationSeconds},
  "paradigm": "cinematic_product | deconstructed | aggressive_sports | ugc_testimonial | atmospheric_story | single_shot_hero | custom",
  "hook_type": "curiosity | social_proof | pain_point | identity | contrarian | transformation | numbers | humor | pattern_break | pov",
  "tone": "Emotional texture in one line: 'midnight confidence, whispered power' or 'adrenaline and chrome, bass-heavy impact'",
  "sections": [
    {
      "label": "Short label (e.g. 'The Toss', 'Hook', 'Hero Reveal')",
      "start_time": 0,
      "end_time": 10,
      "text": "Voiceover text (can be empty for visual-only or music-driven sections)${language === "ar" ? " — in Arabic" : ""}",
      "scene_type": "product_hero | product_detail | macro | lifestyle | environment | talking_head | broll | text_card | kinetic_type | hud_overlay | silhouette",
      "visual_description": "Precise shot description — camera distance, lighting, texture, mood",
      "image_prompt": "Full Nano Banana 2 prompt. 60-100 words of natural prose. Camera specs + film stock + lighting. Use product image_url as reference. For people: 'natural skin texture, visible pores, NOT airbrushed, NOT CGI'. Null if reusing a previous frame.",
      "camera_motion": "Seedance timestamped prompt (see examples above). Camera simulation header + 2-4 phases with timestamps, speed %, movement, visual changes. For Kling fallback: ONE move, 2-3 sentences, NO timestamps.",
      "suggested_model": "seedance_i2v | veo_flf | veo_ugc | kling_flf | kling_multi | broll"
    }
  ],
  "full_script": "Complete voiceover as one flowing piece${language === "ar" ? " (in Arabic)" : ""}. For UGC: this is the lipsync dialogue, NOT a narration track. Can be minimal for aggressive/sports paradigm.",
  "voiceover_direction": "How the voice should FEEL — 'like a late-night confession, intimate' or 'friend recommending something, casual energy' or 'none — music and SFX carry it'",
  "visual_style": "Reference real films/photographers. 'Roger Deakins lighting meets Wes Anderson symmetry' or 'Apple product film meets GenHQ deconstruction'"
}

Return ONLY the JSON. No explanation.`;
}
