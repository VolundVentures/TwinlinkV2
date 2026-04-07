import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { brandId } = await params;

    const { data: brand, error } = await db
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    return NextResponse.json({ brand });
  } catch (error) {
    console.error("Error fetching brand:", error);
    return NextResponse.json({ error: "Failed to fetch brand" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { brandId } = await params;
    const body = await request.json();

    const { data: brand, error } = await db
      .from("brands")
      .update(body)
      .eq("id", brandId)
      .eq("org_id", auth.orgId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ brand });
  } catch (error) {
    console.error("Error updating brand:", error);
    return NextResponse.json({ error: "Failed to update brand" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { brandId } = await params;

    const { error } = await db
      .from("brands")
      .delete()
      .eq("id", brandId)
      .eq("org_id", auth.orgId);

    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting brand:", error);
    return NextResponse.json({ error: "Failed to delete brand" }, { status: 500 });
  }
}
