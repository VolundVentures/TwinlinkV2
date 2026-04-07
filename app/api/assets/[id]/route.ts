import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    // Get asset to find storage path
    const { data: asset } = await db
      .from("user_assets")
      .select("storage_path")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Delete from storage
    if (asset.storage_path) {
      await db.storage.from("assets").remove([asset.storage_path]);
    }

    // Delete DB record
    await db.from("user_assets").delete().eq("id", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
