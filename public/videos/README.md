# Landing page video assets

Drop your films here. The landing page expects:

- `hero.mp4`          — fullbleed hero loop (muted, 10–20s, 1080p)
- `split.mp4`         — "A studio in a browser tab" inset (muted, 10–15s)
- `closing.mp4`       — fullbleed closing CTA loop (muted, 10–20s)
- `film-01.mp4` … `film-06.mp4` — featured reel tiles (muted, 5–10s, hover-to-play)

All videos are rendered `grayscale` via CSS to match the editorial monolith aesthetic —
you can upload colour originals and they'll be desaturated in the browser.

Recommended encode: H.264, ~4 Mbps, no audio track, `-movflags +faststart`.

If a file is missing, the tile falls back to a gradient + grain — layout stays intact.
Poster images (optional, used before the video plays) live in `public/posters/`.
