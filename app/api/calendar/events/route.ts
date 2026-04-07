import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // Format: 2026-03

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid month parameter. Expected format: YYYY-MM" },
        { status: 400 }
      );
    }

    const [year, monthNum] = month.split("-").map(Number);
    const startDate = `${year}-${String(monthNum).padStart(2, "0")}-01`;
    // Last day of the month
    const endDate = new Date(Date.UTC(year, monthNum, 0));
    const endDateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`;

    const { data: events, error } = await db
      .from("market_events")
      .select("*")
      .or(`org_id.eq.${auth.orgId},org_id.is.null`)
      .gte("event_date", startDate)
      .lte("event_date", endDateStr)
      .order("event_date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ events: events ?? [] });
  } catch (error) {
    console.error("Error fetching market events:", error);
    return NextResponse.json(
      { error: "Failed to fetch market events" },
      { status: 500 }
    );
  }
}
