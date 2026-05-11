// Batch-generate the 20 director portraits via gpt_image_2.
//
// Run once after `@runwayml/sdk` is installed and `RUNWAYML_API_SECRET` is set.
// Outputs to public/directors/<id>.png so the Avatar API can use them as
// reference images.
//
// Usage:
//   node --env-file=.env scripts/generate-director-portraits.mjs

import RunwayML from "@runwayml/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, "..", "public", "directors");
fs.mkdirSync(OUT_DIR, { recursive: true });

if (!process.env.RUNWAYML_API_SECRET) {
  console.error("RUNWAYML_API_SECRET not set. Did you pass --env-file=.env?");
  process.exit(1);
}

// Inline persona descriptions — keep this file decoupled from the TS source so
// it can run as a standalone .mjs without ts-node.
const PERSONAS = [
  { id: "marcel-vrai", name: "Marcel Vrai", desc: "Italian-American man, late 60s, gravelly authority, salt-and-pepper hair brushed back, tobacco-stained sweater, NY brownstone behind." },
  { id: "yuki-sato", name: "Yuki Sato", desc: "East Asian man, 50s, contemplative, salt-and-pepper hair, soft cardigan, smoke drifting in foreground, soft window light." },
  { id: "sven-holmgren", name: "Sven Holmgren", desc: "Tall Scandinavian-French man, 50s, austere, short grey hair, dark grey turtleneck, monumental concrete wall behind, low cool key light." },
  { id: "otto-kessler", name: "Otto Kessler", desc: "Mid-Western American man, 70s, white hair swept up, cheerful but uncanny eyes, dark suit, deep red velvet curtain behind, prosthetic-pool lighting." },
  { id: "henrik-aalto", name: "Henrik Aalto", desc: "Elderly Scandinavian man, severe, white hair, deep eye sockets, monochromatic sweater, harsh single key light splitting face into light and shadow, Bergman-coded chiaroscuro." },
  { id: "edgar-loomis", name: "Edgar Loomis", desc: "Mid-Atlantic American man, 50s, fastidious, neatly parted hair, tweed jacket and bowtie, pastel salmon wallpaper behind, dollhouse-symmetric framing." },
  { id: "damien-roux", name: "Damien Roux", desc: "Danish man, 50s, cool dispassionate eyes, short blond hair, black turtleneck, magenta-and-cyan rim lights, deep black background." },
  { id: "aleksandra-volkov", name: "Aleksandra Volkov", desc: "Russian woman, 60s, contemplative, grey hair pulled back, dark wool coat, sepia-toned background of mist and bare birch trees." },
  { id: "nadia-camillo", name: "Nadia Camillo", desc: "Italian-American woman, 40s, soft, dreamy expression, blonde-brown hair, cream silk blouse, soft pastel-pink wallpaper, natural window light." },
  { id: "kaito-mori", name: "Kaito Mori", desc: "Japanese man, 60s, calm authoritative gaze, short grey hair, indigo formal coat, traditional architectural framing behind, dramatic naturalistic side light." },
  { id: "mei-chen", name: "Mei Chen", desc: "Taiwanese woman, 50s, observational, dark hair pulled back, modernist office wear, glass and concrete urban skyline reflected in background, soft natural light." },
  { id: "tomas-vela", name: "Tomás Vela", desc: "Mexican man, 50s, intense focused eyes, dark hair, leather jacket over plain shirt, gritty natural-light Mexico City rooftop background." },
  { id: "catarina-reis", name: "Catarina Reis", desc: "Spanish woman, 60s, vibrant, dramatic, dark red hair, silk patterned blouse, saturated red kitchen wall behind, warm interior incandescent light." },
  { id: "raj-bhattacharya", name: "Raj Bhattacharya", desc: "Bengali man, 70s, gentle scholarly gaze, grey hair and beard, traditional white kurta, terracotta and indigo background of Bengal interior, natural side light." },
  { id: "inge-brandt", name: "Inge Brandt", desc: "German woman, 60s, cool theatrical gaze, sharp white-blonde haircut, black blazer, mustard-yellow walls behind, hard frontal key light." },
  { id: "pauline-tessier", name: "Pauline Tessier", desc: "French woman, 60s, mischievous warm smile, short grey-and-purple hair, chunky knit cardigan, sun-dappled Paris café terrace background." },
  { id: "bruno-salgado", name: "Bruno Salgado", desc: "Brazilian man, 50s, intense polemical gaze, dark hair, denim shirt, sun-bleached sertão ochre and yellow background, hard tropical sunlight." },
  { id: "ezra-stein", name: "Ezra Stein", desc: "Brooklyn Jewish-American man, 60s, gravelly warm, unkempt grey hair, rumpled flannel, cluttered Brooklyn apartment background, available-light kitchen warmth." },
  { id: "zara-okafor", name: "Zara Okafor", desc: "Senegalese woman, 40s, lyrical melancholic gaze, hair wrapped in colorful Sahel-fabric headscarf, indigo and ochre garments, Atlantic coast horizon behind, dusk gold-and-blue light." },
  { id: "felix-marchetti", name: "Felix Marchetti", desc: "Italian man, 70s, theatrical operatic gaze, white hair flowing, silk scarf around neck, baroque Rome architecture and circus tent fragments behind, dramatic warm side light." },
];

const COMMON_PROMPT_PREFIX = `An editorial black-and-white film-magazine portrait, magazine-spread quality. The subject looks slightly off-camera, contemplative. Square 1:1 framing. Soft directional key light. Subtle 35mm film grain. No text overlays, no border, no watermark. The image must read like a director portrait in a serious cinema publication.`;

const client = new RunwayML();

async function generateOne(persona) {
  const prompt = `${COMMON_PROMPT_PREFIX}\n\nSubject: ${persona.desc}`;
  const outPath = path.join(OUT_DIR, `${persona.id}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`  [skip] ${persona.id}.png already exists`);
    return;
  }
  console.log(`  Generating ${persona.id}...`);
  const task = await client.textToImage
    .create({
      model: "gpt_image_2",
      promptText: prompt,
      // gpt_image_2 minimum is 1920px on short side. Smallest 1:1 = 1920:1920.
      ratio: "1920:1920",
    })
    .waitForTaskOutput();

  const url = task.output?.[0];
  if (!url) {
    console.error(`  [fail] ${persona.id}: no output URL`);
    return;
  }
  const res = await fetch(url);
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  console.log(`  [ok]   ${persona.id}.png saved`);
}

console.log(`Generating 20 director portraits to ${OUT_DIR}\n`);
const t0 = Date.now();

// Limit concurrency to 3 to stay under Runway rate limits.
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

console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s. Total cost: ~$1.60 (~160 cr at 5 cr/image × 20).`);
