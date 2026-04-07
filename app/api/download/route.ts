import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const url = req.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Validate it's a proper URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
    }

    // Fetch the file server-side (bypasses CORS)
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstream.status}` },
        { status: 502 }
      );
    }

    // Determine filename from URL path
    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const filename = pathSegments[pathSegments.length - 1] || "download";

    // Stream the response back with download headers
    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[download] Error:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
