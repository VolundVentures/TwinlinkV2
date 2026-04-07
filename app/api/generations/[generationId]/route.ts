import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { generationId } = await params;

    const { data: generation, error } = await db
      .from("generations")
      .select("*, generation_assets(*)")
      .eq("id", generationId)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !generation) {
      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ generation });
  } catch (error) {
    console.error("Error fetching generation:", error);
    return NextResponse.json(
      { error: "Failed to fetch generation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { generationId } = await params;

    const { error } = await db
      .from("generations")
      .delete()
      .eq("id", generationId)
      .eq("org_id", auth.orgId);

    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting generation:", error);
    return NextResponse.json(
      { error: "Failed to delete generation" },
      { status: 500 }
    );
  }
}
