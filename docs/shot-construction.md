# Shot Construction — Hero Keyframe + Compositional Edit Chains

This is the TwinLink methodology for building festival-tier shots. It mirrors the workflow used by reference-tier AI commercials (e.g., the Higgsfield "$350K perfume" tutorial, Luma-ghosted-city spots) and represents a deliberate shift away from the older first-frame-last-frame (FFLF) default.

If you're a user trying to understand what the agent is doing, skim "The five-step mental model." If you're extending the system prompt or adding a new shot pattern, read everything.

---

## Why we moved away from "FFLF by default"

Older builds defaulted every shot to a pair of keyframes: a start frame and an end frame. The video model was then asked to interpolate the motion between them. Two recurring quality failures drove the change:

1. **Weak keyframes, weak shots.** A blurred last frame sank the whole shot because the video model resolved *toward* it. Drift on either end cost us the take.
2. **Limited camera freedom.** The interpolator's job is to get from A to B. Dialogue beats, reveals, emotional close-ups — shots where motion is local or camera-led — ended up flattened because the interpolator insisted on a visible state change.

The fix: **make hero keyframes the default and use FFLF only when the shot contains an explicit, nameable state transition.**

---

## The five-step mental model

Every shot in a festival-tier cut is built in five steps. Four of them are *edits*.

```
1. Plate: clean location                   — generate_plate (location_master)
2. Edit:  composite character in           — edit_plate
3. Edit:  add prop(s)                      — edit_plate
4. Edit:  re-light / re-color / re-frame   — edit_plate
5. Compose: final keyframe                 — generate_keyframe (hero)
   → animate: generate_video
```

Each edit changes one axis while preserving the rest. The chain is how identity holds across 3–7 compositional steps.

---

## When to use `hero` vs. `first_and_last`

| Shot type | Plan | Why |
|---|---|---|
| Dialogue (two shots, shot/reverse) | hero | Motion is gaze + micro-expression. |
| Close-up on a reaction | hero | Motion is implied by held breath, shift of eyes. |
| Product reveal | hero | Motion is the video model's job; one keyframe is enough. |
| Kiss, emotional landing | hero | Proximity change is micro; Kling handles it. |
| Held environmental establishing | hero | Almost no motion. |
| CCTV / POV shift through space | hero | Fisheye + scan-lines + movement is prompt-driven. |
| Door closed → door open | first_and_last | 5-word nameable transition. |
| Lasers off → lasers on | first_and_last | Discrete state change. |
| Outside vent → inside vent | first_and_last | Physical crossing, two distinct spaces. |
| Dry window → rain streaming | first_and_last | Practical state change. |
| Dusk → neon on | first_and_last | Lighting transition across the frame. |

**Rule:** if you can't name the transition in ≤5 words, use `hero`.

---

## The six reusable edit patterns

Every compositional edit in the pipeline reduces to one of these six shapes. Use them as verbatim starting points.

### 1. Integrate character into location

```
edit_plate(
  target_tag="mansion_lobby",
  edit_instruction="Place @orlando waist-up in the foreground-left, facing camera, engaged in conversation. Preserve the location's geometry, materials, and lighting exactly.",
  reference_tags=["orlando"]
)
```

### 2. Add prop to an existing frame

```
edit_plate(
  target_tag="kf_shot5_base",
  edit_instruction="Add a matte black pistol in her right hand at hip level. Preserve pose, wardrobe, and lighting exactly.",
  reference_tags=["pistol"]
)
```

### 3. Remove element

```
edit_plate(
  target_tag="laser_room_with_spy",
  edit_instruction="Remove all red laser beams from the frame. Preserve the spy, the pedestal, the room, and the lighting exactly."
)
```

### 4. Shift camera angle

```
edit_plate(
  target_tag="kf_shot8_hero",
  edit_instruction="Change the camera angle 15 degrees to the left. Preserve pose, wardrobe, subject identity, and background geometry."
)
```

### 5. Re-light / re-grade

```
edit_plate(
  target_tag="secret_room",
  new_tag="secret_room_red",
  edit_instruction="Flood the entire scene with deep crimson practical lighting. Remove all blue and cool tones. Preserve subject pose and geometry."
)
```

### 6. Compose two characters into one frame

```
edit_plate(
  target_tag="kf_shot12_solo_orlando",
  edit_instruction="Add @maria on the right side of the frame, aiming a pistol at @orlando. Preserve @orlando exactly — pose, wardrobe, lighting, face.",
  reference_tags=["maria", "pistol"]
)
```

### Rules for every edit

- **Name what to preserve.** Identity, pose, geometry, lighting — name whichever stays fixed. Without a preserve clause, the model drifts.
- **One change per step.** "Add character AND change lighting" is two edits. Stack them.
- **Reference plates when adding identity-bearing elements.** A new character or a specific product must appear in `reference_tags` so the edit model has a source of truth.
- **Branch with `new_tag` when intermediates matter.** If the pre-edit version is also used elsewhere (e.g., the clean location used by three shots), use `new_tag` to create a branch rather than overwriting.

---

## Cast — per-costume variants

When a character changes wardrobe across the film, create a variant plate branched from the base character:

```
edit_plate(
  target_tag="orlando",
  new_tag="orlando_spy_costume",
  edit_instruction="Re-dress the character in a matte-black close-fitting tactical suit with articulated shoulder and knee panels, slim reinforced gloves, lightweight harness straps, belt-line utility modules. Preserve the face, hair, build, and skin exactly. Keep the neutral grey backdrop."
)
```

- Base: `@orlando` — character_sheet plate, neutral backdrop, identity anchor
- Variants: `@orlando_spy_costume`, `@orlando_civilian`, etc.

Re-use the variant across all shots featuring that costume. One face, many wardrobes, consistent across cuts.

---

## Writing a `shot_build` chain in the script

The `write_script` tool emits one shot per scene beat. Multi-element shots should include a `shot_build` array — the explicit ordered chain the agent will execute. Here's the canonical example: *spy reaches for the perfume while a woman off-screen aims a gun; deep red lighting.*

```json
{
  "id": "shot_12",
  "label": "reach, gun enters, red lights",
  "keyframe_plan": "hero",
  "motion": "static camera. spy grabs the bottle; alarm reddens the room; gun enters from the right.",
  "shot_build": [
    {
      "kind": "edit_plate",
      "target_tag": "secret_room",
      "new_tag": "secret_room_red",
      "edit_instruction": "Flood the room with deep crimson practical lighting. Remove all blue tones. Preserve pedestal, walls, geometry."
    },
    {
      "kind": "edit_plate",
      "target_tag": "secret_room_red",
      "new_tag": "kf_shot12_base",
      "edit_instruction": "Place @orlando_spy_costume reaching toward the perfume on the pedestal. Preserve location geometry and red lighting. Shallow DoF focused on perfume.",
      "reference_tags": ["orlando_spy_costume", "perfume_bottle"]
    },
    {
      "kind": "edit_plate",
      "target_tag": "kf_shot12_base",
      "edit_instruction": "Add @maria's gun hand entering from the right edge — only the hand and forearm visible, aiming the pistol at @orlando. Preserve everything else.",
      "reference_tags": ["maria", "pistol"]
    },
    { "kind": "compose_keyframe", "role": "hero" }
  ]
}
```

The agent executes the four steps in order: three `edit_plate` calls, then one `generate_keyframe` call with the shot's `shot_spec`.

**Write a chain when:**
- Two or more characters are in frame together.
- A new prop must be integrated into an existing scene.
- The shot reuses a prior keyframe with a specific alteration (camera shift, lighting change, element removal).
- The shot is the second-or-later beat in a scene and should inherit the established mood via edits.

**Leave `shot_build` empty when:**
- The shot is a direct composition from plates already listed in `plate_refs`, no intermediate steps.
- The shot is an end card (static or text fade).

---

## Shot-count & duration pacing

Festival-tier commercial pacing runs roughly one shot every 4 seconds on average, with individual shots between 2 and 5 seconds.

- 15s film ≈ 4 shots
- 30s film ≈ 8 shots
- 60s film ≈ 15 shots
- 120s film ≈ 30 shots

**Hard 5s cap per shot.** Kling fills longer interpolations with noise — if a beat needs more screen time, split it into two or three shots with match cuts (graphic / action / light continuity).

---

## Cost impact

Compositional editing adds tool calls per shot. Budget accordingly.

| Pattern | generate_plate | edit_plate | generate_keyframe | Total credits (typical) |
|---|---|---|---|---|
| Direct compose (no chain) | 0 | 0 | 2 | 2 |
| 3-step chain (character into location + prop + compose) | 0 | 4 (2 × 2) | 2 | 6 |
| 5-step chain (re-light + character + character + prop + compose) | 0 | 8 (4 × 2) | 2 | 10 |
| FFLF pair with chain | 0 | 4+ | 4 (2 × 2) | 8+ |

A 15-shot film where most shots have 2–3 edit steps lands at roughly 90–150 credits just for keyframes, versus ~30 in the old direct-compose pipeline. The quality uplift is the reason to accept the cost.

---

## Where to see the chain in the UI

Open **Scene Builder** from the dashboard sidebar (or from any generation detail page via "open in scene builder"). Each shot renders as a card with:

- Header: shot id, label, duration, keyframe plan.
- Motion prompt.
- **Build chain strip:** plates → edits → keyframe → video, left-to-right, with thumbnails connected by arrows. Click any step to open a lightbox; click "request edit →" under a step to navigate back to the Director with a prefilled refinement message.
- **Cast rail (left):** characters and locations grouped with their variants. Click a variant to open its lightbox.

This is the view that makes the methodology visible to users beyond the person writing the prompt.
