import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCredits } from "@/lib/credits";

export async function GET() {
  try {
    const auth = await requireAuth();
    const balance = await getCredits(auth.orgId);

    return NextResponse.json({ balance });
  } catch (error) {
    console.error("Error fetching credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}
