// GET /api/directors — return the lobby director list (no secrets, no
// inspiration, no full personality).
//
// Public endpoint — no auth needed since the persona JSON is build-time content.

import { NextResponse } from "next/server";
import { getLobbyDirectors } from "@/lib/directors";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ directors: getLobbyDirectors() });
}
