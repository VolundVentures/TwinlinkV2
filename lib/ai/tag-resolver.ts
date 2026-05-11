import { db } from "@/lib/db";

/**
 * Resolves @tag references in prompts and reference lists to asset URLs.
 *
 * Pattern: @lowercase_snake_case — e.g. @orlando, @bathroom_wide, @blowgun
 * Tags are unique per generation (enforced by partial unique index in DB).
 *
 * The agent writes prompts using @tags so identity/locations/props stay stable
 * across plates → keyframes → shots. The tool layer resolves them before
 * calling providers.
 */

const TAG_PATTERN = /@([a-z][a-z0-9_]*)/g;

export type TagResolution = {
  resolved: string; // text with @tags replaced by [Image N] markers
  imageUrls: string[]; // ordered list matching markers (index 0 → [Image1])
  tagMap: Record<string, number>; // @tag → 1-based index
  unresolved: string[]; // tags that had no matching asset
};

/**
 * Find all @tags in `text` (plus any explicit `extraTags`), look them up in
 * the DB, and return a prompt rewritten to use [Image1]…[ImageN] tokens
 * alongside the ordered URL list ready for the provider's reference field.
 */
export async function resolveTags(
  text: string,
  generationId: string,
  extraTags: string[] = []
): Promise<TagResolution> {
  const fromText = Array.from(text.matchAll(TAG_PATTERN)).map((m) => m[1]);
  const fromExtras = extraTags.map((t) => t.replace(/^@/, ""));
  const allTags = Array.from(new Set([...fromText, ...fromExtras]));

  if (allTags.length === 0) {
    return { resolved: text, imageUrls: [], tagMap: {}, unresolved: [] };
  }

  // Primary query: match on the indexed `tag` column.
  const { data: rows, error } = await db
    .from("generation_assets")
    .select("tag, public_url, metadata")
    .eq("generation_id", generationId)
    .in("tag", allTags);

  if (error) {
    console.error("[tag-resolver] DB error (tag column):", error);
  }

  const tagToUrl = new Map<string, string>();
  for (const r of (rows || []) as Array<{ tag: string | null; public_url: string | null }>) {
    if (r.tag && r.public_url) tagToUrl.set(r.tag, r.public_url);
  }

  // Fallback: scan rows with the tag stored in metadata (for rows written before the `tag`
  // column migration landed, or where a column-write failed silently).
  const stillMissing = allTags.filter((t) => !tagToUrl.has(t));
  if (stillMissing.length > 0) {
    const { data: metaRows } = await db
      .from("generation_assets")
      .select("public_url, metadata")
      .eq("generation_id", generationId)
      .not("metadata->>tag", "is", null);
    for (const r of (metaRows || []) as Array<{
      public_url: string | null;
      metadata: Record<string, unknown> | null;
    }>) {
      const metaTag = (r.metadata?.tag as string | undefined)?.replace(/^@/, "").toLowerCase();
      if (metaTag && stillMissing.includes(metaTag) && r.public_url && !tagToUrl.has(metaTag)) {
        tagToUrl.set(metaTag, r.public_url);
      }
    }
  }

  const unresolved = allTags.filter((t) => !tagToUrl.has(t));
  const imageUrls: string[] = [];
  const tagMap: Record<string, number> = {};

  // Preserve order of first appearance for predictable [Image N] numbering
  let index = 1;
  for (const tag of allTags) {
    const url = tagToUrl.get(tag);
    if (url) {
      imageUrls.push(url);
      tagMap[tag] = index++;
    }
  }

  // Rewrite @tags → [Image N]
  const resolved = text.replace(TAG_PATTERN, (match, tag) => {
    const idx = tagMap[tag];
    return idx ? `[Image${idx}]` : match;
  });

  return { resolved, imageUrls, tagMap, unresolved };
}

/** Validate a proposed @tag — lowercase snake_case, starts with a letter. */
export function isValidTag(tag: string): boolean {
  const stripped = tag.replace(/^@/, "");
  return /^[a-z][a-z0-9_]*$/.test(stripped);
}

/** Normalize to "tag" (no @). */
export function normalizeTag(tag: string): string {
  return tag.replace(/^@/, "").toLowerCase();
}
