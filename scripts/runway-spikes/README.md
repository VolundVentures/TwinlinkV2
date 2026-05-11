# Runway API Spike Tests

Three small, single-purpose probes that verify the riskiest Runway features before any integration work begins. Each script makes one or two API calls, downloads the result, and saves it to `output/`. **Eyeball the outputs visually** — these tests pass or fail based on whether the result looks right, not based on whether the API returned 200.

## Setup (one-time)

```powershell
# In the project root
npm install @runwayml/sdk
```

`RUNWAYML_API_SECRET` should already be in `.env`. Confirm with:

```powershell
Select-String -Pattern "RUNWAYML_API_SECRET" .env
```

## Run each spike

Use Node 20+ with the `--env-file` flag so the secret loads from `.env` without leaking to shell history:

```powershell
node --env-file=.env scripts/runway-spikes/01-character-bible.mjs
node --env-file=.env scripts/runway-spikes/02-seedance-storyboard-grid.mjs
node --env-file=.env scripts/runway-spikes/03-aleph-coverage-5s.mjs
```

Each script prints elapsed time and the saved file path.

## Pass/fail criteria

| Spike | Passes if... | Fails if... |
|---|---|---|
| **01 character bible** | Output looks like a real production character sheet — multiple panels, consistent face across angles, expression progression panels readable | Single portrait, unreadable panel labels, faces drift between angles, generic stock illustration look |
| **02 storyboard grid** | The 15s video covers all panel beats in order, the camera/character/action evolve as the storyboard prescribes | The video ignores the panels, only animates panel 1, or treats the grid as a single scene |
| **03 aleph coverage** | The two Aleph variants feel like coverage of the *same* fictional moment from different angles. Lighting/character/wardrobe consistent across master and variants | The variants look like different scenes entirely, or only re-grade the original instead of changing angle |

## If a spike fails

| Spike fails | Implication | Fallback |
|---|---|---|
| 01 | gpt_image_2 prompts need more iteration; the example sheets we have set the bar high. Iterate on prompt before falling back. | Use `gen4_image` with simpler bible (one panel per call, stitched in PDF dossier). |
| 02 | Storyboard-as-timeline doesn't work. Big architectural rethink — generate per-panel separately and stitch via Remotion. | Per-panel Seedance i2v with hard cuts in compositor. Loses one wow moment. |
| 03 | **Critical.** Aleph coverage was the foundation of the cinema-coverage demo claim. | Use 2 separate Seedance generations of the same scene from different prompt angles as "coverage" — less novel, more expensive, but functional. |
