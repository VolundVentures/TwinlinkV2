import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  //
  // JWK fetch can fail transiently (network blip, Supabase slow). One retry
  // + a fail-open fallback prevents a single dropped request from logging
  // the user out mid-session.
  let user: unknown = null;
  let authFetchFailed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await supabase.auth.getClaims();
      if (error) throw new Error(error.message);
      user = data?.claims ?? null;
      authFetchFailed = false;
      break;
    } catch (err) {
      authFetchFailed = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[middleware] getClaims attempt ${attempt + 1}/2 failed: ${msg}`
      );
      if (attempt === 0) await new Promise((r) => setTimeout(r, 200));
    }
  }

  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  const publicRoutes = [
    "/",
    "/login",
    "/signup",
    "/pricing",
    "/onboarding",
    "/api/auth",
    "/api/webhooks",
  ];

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // API routes should return 401, not redirect to login
  const isApiRoute = pathname.startsWith("/api/");

  if (!user && !isPublicRoute) {
    // Fail-open for page requests when auth JWK fetch itself failed — the
    // downstream server component still calls requireAuth() which will do a
    // fresh retry. Better than kicking a logged-in user to /login and
    // losing their query params because Supabase had a 2-second blip.
    if (authFetchFailed && !isApiRoute) {
      return supabaseResponse;
    }
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the original search (e.g. ?resume=...) so the user lands back
    // on the exact same page after signing in, not just the pathname.
    const fullTarget = pathname + (request.nextUrl.search || "");
    url.search = "";
    url.searchParams.set("redirect", fullTarget);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
