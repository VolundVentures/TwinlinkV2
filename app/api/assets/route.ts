import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/assets — list user's uploaded assets + generated assets
export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // image, video, audio
    const limit = parseInt(searchParams.get("limit") || "100");

    // 1. User-uploaded assets
    let userQuery = db
      .from("user_assets")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false })
      .limit(Math.floor(limit / 2));

    if (type) userQuery = userQuery.eq("type", type);

    const { data: userAssets } = await userQuery;

    // 2. Generated assets (images, videos, audio from generations)
    let genQuery = db
      .from("generation_assets")
      .select("id, type, public_url, metadata, created_at, aspect_ratio, generation_id")
      .eq("org_id", auth.orgId)
      .in("type", type ? [type] : ["image", "video", "audio"])
      .not("public_url", "like", "script://%")
      .order("created_at", { ascending: false })
      .limit(Math.floor(limit / 2));

    const { data: genAssets } = await genQuery;

    // Merge and normalize
    const merged = [
      ...(userAssets || []).map((a: Record<string, unknown>) => ({
        id: a.id,
        name: (a.name as string) || "Uploaded asset",
        type: a.type,
        url: a.public_url || a.storage_url,
        source: "upload" as const,
        created_at: a.created_at,
        metadata: a.metadata,
      })),
      ...(genAssets || []).map((a: Record<string, unknown>) => ({
        id: a.id,
        name: ((a.metadata as Record<string, string>)?.concept_name || (a.metadata as Record<string, string>)?.title || (a.metadata as Record<string, string>)?.asset_category || (a.type as string)) as string,
        type: a.type,
        url: a.public_url,
        source: "generated" as const,
        created_at: a.created_at,
        aspect_ratio: a.aspect_ratio,
        generation_id: a.generation_id,
        metadata: a.metadata,
      })),
    ].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());

    return NextResponse.json({ assets: merged });
  } catch (error) {
    console.error("[api/assets] Error:", error);
    return NextResponse.json({ assets: [] });
  }
}

// POST /api/assets — upload a new asset
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = (formData.get("name") as string) || file?.name || "Untitled";
    const source = (formData.get("source") as string) || "upload"; // upload, chat, generation

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Determine type from mime
    let assetType = "image";
    if (file.type.startsWith("video/")) assetType = "video";
    else if (file.type.startsWith("audio/")) assetType = "audio";

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${auth.orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Ensure bucket exists
    await db.storage.createBucket("assets", { public: true }).catch(() => {});

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await db.storage
      .from("assets")
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("[api/assets] Upload error:", uploadError.message);
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = db.storage.from("assets").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // Save to user_assets table
    const { data: asset, error: dbError } = await db
      .from("user_assets")
      .insert({
        org_id: auth.orgId,
        user_id: auth.id,
        name,
        type: assetType,
        url: publicUrl,
        storage_path: fileName,
        file_size: file.size,
        mime_type: file.type,
        source,
      })
      .select("*")
      .single();

    if (dbError) {
      // If table doesn't exist, just return the URL without DB record
      if (dbError.code === "42P01") {
        return NextResponse.json({ asset: { id: null, url: publicUrl, name, type: assetType } });
      }
      console.error("[api/assets] DB error:", dbError.message);
      return NextResponse.json({ asset: { id: null, url: publicUrl, name, type: assetType } });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("[api/assets] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
