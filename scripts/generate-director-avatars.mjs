// Batch-generate the 20 director AVATAR REFERENCE images via gpt_image_2.
//
// These are DIFFERENT from the gallery portraits in public/directors/:
//   - Frontal head-and-shoulders, looking directly at camera
//   - Neutral / relaxed expression, mouth closed or barely parted
//   - Soft, even, diffused lighting (no chiaroscuro, no theatrical key)
//   - Photorealistic skin tones (no monochrome, no editorial filter)
//   - Per-persona contextual background (their working space)
//   - 3:2 ratio (close to Runway's recommended 1088×704 for Characters API)
//
// CRITICAL: each avatar generation passes the corresponding gallery portrait
// (public/directors/<id>.png) as a reference image. Without this, gpt_image_2
// would invent a new face from the text description on every call, and the
// director the user sees in the lobby would look different from the one
// who shows up on the Characters API video call. The `@ref` tag in the prompt
// pins the avatar to the gallery face's identity.
//
// These get uploaded to Runway by `/api/avatar/session` and used as the
// `referenceImage` for the Characters API avatar — the "mask" Runway animates
// for live conversation.
//
// Output: public/directors/avatars/<id>.png
//
// Usage:
//   node --env-file=.env scripts/generate-director-avatars.mjs

import RunwayML from "@runwayml/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GALLERY_DIR = path.join(__dirname, "..", "public", "directors");
const OUT_DIR = path.join(__dirname, "..", "public", "directors", "avatars");
fs.mkdirSync(OUT_DIR, { recursive: true });

if (!process.env.RUNWAYML_API_SECRET) {
  console.error("RUNWAYML_API_SECRET not set. Did you pass --env-file=.env?");
  process.exit(1);
}

// Persona descriptions — same physical traits as the gallery script, but
// described for a frontal naturalistic headshot, plus a context background
// that fits the director's school. The background should support the
// performance, not compete with it — soft, slightly out-of-focus, atmospheric.
const PERSONAS = [
  {
    id: "marcel-vrai",
    desc: "Italian-American man, late 60s, gravelly authority, salt-and-pepper hair brushed back, slight stubble, tobacco-colored cardigan over open-collar shirt",
    bg: "wood-paneled NYC editing room behind him, slightly out of focus — film reels and old movie posters on shelves, warm tungsten desk lamp glow",
  },
  {
    id: "yuki-sato",
    desc: "East Asian man, 50s, contemplative composure, salt-and-pepper hair softly brushed, soft dark cardigan over collared shirt",
    bg: "dim hotel hallway behind him, soft magenta neon spilling in from one side, faint smoke drifting through the background, slightly out of focus",
  },
  {
    id: "sven-holmgren",
    desc: "Tall Scandinavian-French man, 50s, austere quiet presence, short grey hair, dark grey turtleneck",
    bg: "brutalist concrete office behind him, single tall floor lamp casting soft cool ambient, vast architectural concrete wall, slightly out of focus",
  },
  {
    id: "otto-kessler",
    desc: "Mid-Western American man, 70s, white hair swept upward, kind but uncanny gaze, dark suit jacket over a clean white shirt",
    bg: "wood-paneled study behind him, deep red velvet curtain visible in one corner, single warm lamp casting a pool of light, slightly out of focus",
  },
  {
    id: "henrik-aalto",
    desc: "Elderly Scandinavian man, severe but warm gaze, white hair, simple dark woolen sweater",
    bg: "Scandinavian study behind him, plain off-white wall, single tall north-facing window casting soft side light, slightly out of focus",
  },
  {
    id: "edgar-loomis",
    desc: "Mid-Atlantic American man, 50s, fastidious calm, neatly parted hair, tweed jacket and bow tie",
    bg: "pastel salmon-pink study behind him, neatly arranged rows of vintage books, hand-painted typography on a wooden box visible, slightly out of focus",
  },
  {
    id: "damien-roux",
    desc: "Danish man, 50s, cool dispassionate gaze, short blond hair, plain black turtleneck",
    bg: "black office behind him, single horizontal magenta neon strip on the back wall, glossy black surfaces, deep negative space, slightly out of focus",
  },
  {
    id: "aleksandra-volkov",
    desc: "Russian woman, 60s, contemplative grave gaze, grey hair pulled back simply, warm dark wool sweater",
    bg: "dacha library behind her, birch trees visible through a window in the far background, sepia warmth, leather-bound books on shelves, slightly out of focus",
  },
  {
    id: "nadia-camillo",
    desc: "Italian-American woman, 40s, soft considered gaze, blonde-brown shoulder-length hair, cream silk blouse",
    bg: "pastel-pink salon behind her, cream silk drapery softly folded, soft natural window light pouring from the side, slightly out of focus",
  },
  {
    id: "kaito-mori",
    desc: "Japanese man, 60s, calm authoritative gaze, short grey hair, indigo formal coat over neutral shirt",
    bg: "tatami room behind him, single ink scroll on the wall, soft paper-screen daylight, traditional Japanese architectural lines, slightly out of focus",
  },
  {
    id: "mei-chen",
    desc: "Taiwanese woman, 50s, observational calm gaze, dark hair pulled back, modernist minimalist blouse",
    bg: "modernist Taipei office behind her, glass and concrete cityscape softly visible through floor-to-ceiling windows, late-afternoon light, slightly out of focus",
  },
  {
    id: "tomas-vela",
    desc: "Mexican man, 50s, intense focused gaze, dark hair, brown leather jacket over plain shirt",
    bg: "Mexico City rooftop workspace behind him during golden hour, simple wooden desk and a few film books visible, warm amber sunlight, slightly out of focus",
  },
  {
    id: "catarina-reis",
    desc: "Spanish woman, 60s, vibrant warm gaze, dark red hair, patterned silk blouse",
    bg: "saturated red Spanish kitchen behind her, hand-painted patterned tile, copper pots and a single warm pendant lamp, slightly out of focus",
  },
  {
    id: "raj-bhattacharya",
    desc: "Bengali man, 70s, gentle scholarly gaze, grey hair and short beard, traditional white kurta",
    bg: "Bengali interior behind him, terracotta walls, a harmonium resting on a low table, warm side light from a wooden shutter, slightly out of focus",
  },
  {
    id: "inge-brandt",
    desc: "German woman, 60s, cool theatrical gaze, sharp white-blonde haircut, simple black blazer",
    bg: "mustard-yellow West Berlin office behind her, vintage furniture, single hard frontal soft-box light shaping the space, slightly out of focus",
  },
  {
    id: "pauline-tessier",
    desc: "French woman, 60s, mischievous warm gaze with a faint smile, short grey-and-purple hair, chunky knit cardigan",
    bg: "sunny Paris café terrace behind her, dappled afternoon light through plane trees, books and a fountain pen on a small marble table, slightly out of focus",
  },
  {
    id: "bruno-salgado",
    desc: "Brazilian man, 50s, intense polemical gaze, dark hair, denim shirt",
    bg: "sun-bleached sertão room behind him, ochre wall, hard tropical sunlight cutting through wooden shutter slats, single rough wooden desk, slightly out of focus",
  },
  {
    id: "ezra-stein",
    desc: "Brooklyn Jewish-American man, 60s, gravelly warm gaze, unkempt grey hair, rumpled flannel shirt",
    bg: "Brooklyn brownstone kitchen behind him, available tungsten light, cluttered shelves of books and battered film equipment, slightly out of focus",
  },
  {
    id: "zara-okafor",
    desc: "Senegalese woman, 40s, lyrical melancholic gaze, hair wrapped in a colorful Sahel-fabric headscarf, indigo cotton garment",
    bg: "Atlantic coast room at dusk behind her, indigo-and-ochre walls, single warm lamp glow, faint glimpse of the sea through a window, slightly out of focus",
  },
  {
    id: "felix-marchetti",
    desc: "Italian man, 70s, theatrical operatic gaze, white hair flowing slightly, silk scarf around neck",
    bg: "baroque Roman study behind him, gilded mirror in one corner, theatrical warm side light, framed sketches and old playbills on the wall, slightly out of focus",
  },
];

const PROMPT_PREFIX = `A photorealistic naturalistic head-and-shoulders portrait of @ref, professional casting headshot quality. CRITICAL: keep the same face, identity, age, ethnicity, hair color, hair style, and distinguishing features as @ref — this is the same person, just photographed differently. Only the framing, lighting, expression, and background change. The subject is looking DIRECTLY into the camera, eyes meeting the lens. Neutral relaxed expression with mouth closed or barely parted — no smile, no frown, no theatrical drama. Soft even diffused lighting from the front, no chiaroscuro, no harsh side-key. The composition is centered head-and-shoulders, frontal pose, head and torso facing the camera. Background is slightly out of focus and softly blurred. Photographic skin tones, fine pore detail, no editorial filter, no monochrome, no painterly stylization. Subtle 35mm photographic feel. The image should read like a contemporary professional headshot photograph, not an editorial magazine cover.`;

const client = new RunwayML();

// Upload the gallery portrait once and reuse the runway:// URI.
async function uploadGalleryPortrait(personaId) {
  const galleryPath = path.join(GALLERY_DIR, `${personaId}.png`);
  if (!fs.existsSync(galleryPath)) {
    throw new Error(
      `Gallery portrait not found at ${galleryPath}. ` +
        `Run \`node --env-file=.env scripts/generate-director-portraits.mjs\` first.`
    );
  }
  const stream = fs.createReadStream(galleryPath);
  const upload = await client.uploads.createEphemeral({ file: stream });
  return upload.uri;
}

async function generateOne(persona) {
  const outPath = path.join(OUT_DIR, `${persona.id}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`  [skip] ${persona.id}.png already exists`);
    return;
  }
  console.log(`  Generating avatar for ${persona.id}...`);

  // Upload gallery portrait → reference URI.
  const refUri = await uploadGalleryPortrait(persona.id);

  const prompt = `${PROMPT_PREFIX}\n\nIdentity (locked from @ref): ${persona.desc}.\n\nNew background for this frontal headshot: ${persona.bg}.`;

  const task = await client.textToImage
    .create({
      model: "gpt_image_2",
      promptText: prompt,
      // 3:2 ratio close to Runway's recommended 1088×704 for Characters API.
      ratio: "1920:1280",
      referenceImages: [{ uri: refUri, tag: "ref" }],
    })
    .waitForTaskOutput();

  const url = task.output?.[0];
  if (!url) {
    console.error(`  [fail] ${persona.id}: no output URL`);
    return;
  }
  const res = await fetch(url);
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  console.log(`  [ok]   avatars/${persona.id}.png saved`);
}

console.log(`Generating 20 director AVATAR REFERENCE images to ${OUT_DIR}\n`);
const t0 = Date.now();

const POOL = 3;
let i = 0;
async function worker() {
  while (i < PERSONAS.length) {
    const idx = i++;
    try {
      await generateOne(PERSONAS[idx]);
    } catch (err) {
      console.error(`  [fail] ${PERSONAS[idx].id}: ${err?.message || err}`);
    }
  }
}
await Promise.all(Array.from({ length: POOL }, () => worker()));

console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s. Total cost: ~$1.60-3 (~5-8 cr × 20 at gpt_image_2).`);
