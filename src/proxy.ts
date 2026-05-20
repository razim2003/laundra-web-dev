import { NextResponse, type NextRequest } from "next/server";
import { isAuthBypassEnabled } from "@/lib/auth-bypass";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

function safeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/** Routes anyone can open without signing in (marketing, shared tracking links). */
function isPublicRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/api/auth/register") return true;
  if (pathname.startsWith("/track/")) return true;
  return false;
}

function isAuthRoute(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/login") || pathname.startsWith("/signup");
}

export async function proxy(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request);

  if (!supabase) {
    return response;
  }

  const pathname = request.nextUrl.pathname;

  if (isAuthBypassEnabled()) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileRole: string | null | undefined;

  const needsProfile =
    !!user &&
    (isAuthRoute(pathname) ||
      pathname.startsWith("/rider") ||
      pathname.startsWith("/customer") ||
      pathname.startsWith("/booking"));

  if (needsProfile) {
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle();
    profileRole = prof?.role ?? null;
  }

  if (user && profileRole) {
    if (pathname.startsWith("/rider") && profileRole === "customer") {
      return NextResponse.redirect(new URL("/customer", request.url));
    }
    if (pathname.startsWith("/customer") && profileRole === "rider") {
      return NextResponse.redirect(new URL("/rider", request.url));
    }
    if (pathname.startsWith("/booking") && profileRole === "rider") {
      return NextResponse.redirect(new URL("/rider", request.url));
    }
  }

  if (isAuthRoute(pathname)) {
    if (!user) {
      return response;
    }

    const nextDest = safeInternalPath(request.nextUrl.searchParams.get("next"));
    if (nextDest) {
      return NextResponse.redirect(new URL(nextDest, request.url));
    }

    if (pathname.startsWith("/signup")) {
      const wantsRider = request.nextUrl.searchParams.get("role") === "rider";
      if (wantsRider && profileRole === "customer") {
        return NextResponse.redirect(new URL("/login?switch=rider", request.url));
      }
      const url = request.nextUrl.clone();
      url.search = "";
      url.pathname = profileRole === "rider" ? "/rider" : "/customer";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/login") || pathname === "/auth") {
      const switchRider = request.nextUrl.searchParams.get("switch") === "rider";
      if (switchRider && profileRole === "customer") {
        return response;
      }
      const url = request.nextUrl.clone();
      url.search = "";
      url.pathname = profileRole === "rider" ? "/rider" : "/customer";
      return NextResponse.redirect(url);
    }

    return response;
  }

  if (!user) {
    if (isPublicRoute(pathname)) {
      return response;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const dest = `${pathname}${request.nextUrl.search}`;
    url.searchParams.set("next", dest);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
