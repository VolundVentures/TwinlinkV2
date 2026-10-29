# TwinLink Director

A virtual film studio for directors. Cast a fictional auteur, brief them, and approve each stage of a short film: treatment → plates → keyframes → 25-second scenes → cut → 4K master.

Every pixel and every sound is generated through the **Runway API**:

| Stage | Model | Notes |
|---|---|---|
| Plates, keyframes, end cards | `gpt_image_2_5_sunburst` | ≤16 tagged reference images, 1K/2K/4K |
| Scenes | `seedance2_5` | **25 s** per scene (4–30 s), native dialogue/foley/ambience, 720p or 1080p |
| Coverage / grade / edits | `seedance2_5` video-to-video | `reference` mode for new angles, `edit` mode for in-place changes |
| Voiceover | `eleven_v3` | expressive tags (`[whispers]`, `[laughs]`) |
| Score | `seed_audio` | instrumental brief → track |
| Ambient bed (optional) | `eleven_text_to_sound_v2` | |
| 4K master | `magnific_video_upscaler_creative` | optional fps boost |

Composition (cut + VO + score mix) runs on Remotion Lambda. Reference-image search uses Firecrawl. The agent and script writer run on OpenAI (`gpt-6-sol` by default).

## Run it

```bash
cp .env.example .env   # fill in RUNWAYML_API_SECRET, OPENAI_API_KEY, Supabase, Remotion
pnpm install
pnpm dev
```

Open http://localhost:3000/dashboard/director.

## How a film gets made

1. **Cast** — pick a lead director (and optionally a co-director) from twenty personas. The lead's voice is the agent's chat voice; their school shapes plates, keyframes, scene direction and score.
2. **Brief** — duration, aspect ratio, the idea, optional reference images.
3. **Treatment** — `write_script` returns plates + scenes. A 30 s film is one 25 s scene plus an end card; 60 s is two scenes.
4. **Plates** — identity references (characters, locations, props) via GPT Image 2.5.
5. **Keyframes** — frame 0 of each scene, composed from plates with `edit_plate` chains.
6. **Scenes** — Seedance 2.5 renders each keyframe into a 25 s scene from a ≤220-word scene direction (camera rule, timed beats, dialogue in quotes, sound cues in brackets).
7. **Cut** — optional coverage, signature grade and surgical edits, all Seedance video-to-video.
8. **Post** — VO + score, Remotion compose, `finish_film` for the 4K master, dossier download.

Every stage is an approval gate. Nothing renders before you say so.

## Layout

- `lib/runway/` — the only generation client (`image.ts`, `video-seedance.ts`, `video-upscale.ts`, `audio.ts`).
- `lib/ai/tools/` — agent tools; `registry.ts` is the list.
- `lib/ai/agent-system-prompt.ts` and `lib/ai/prompts/script-writer.ts` — the director's brain.
- `lib/directors/personas/*.json` — the twenty personas.
- `components/director/` — the studio UI.
- `remotion/` — the composition.
