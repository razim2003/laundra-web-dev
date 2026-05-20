"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginUrlForBooking } from "@/lib/marketing-links";
import { useSupabaseUser } from "@/lib/supabase/session";
import { useLaundraRuntime } from "@/components/useLaundraRuntime";
import AuthChrome from "@/components/chrome/AuthChrome";
import CustomerChrome from "@/components/chrome/CustomerChrome";
import MarketingChrome from "@/components/chrome/MarketingChrome";
import RiderChrome from "@/components/chrome/RiderChrome";

type Shell = "marketing" | "customer" | "rider" | "auth";

function shellForPath(pathname: string): Shell {
  if (pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname === "/auth") return "auth";
  if (pathname.startsWith("/customer")) return "customer";
  if (pathname.startsWith("/rider")) return "rider";
  return "marketing";
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const shell = useMemo(() => shellForPath(pathname), [pathname]);
  const appClassName = pathname === "/" ? undefined : "visible route-instant";
  const { profile, loading: authLoading, user } = useSupabaseUser();

  useLaundraRuntime(pathname);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isTyping =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (!isTyping && e.key === "b") {
        if (!authLoading && profile?.role === "rider") router.push("/rider");
        else if (!authLoading && !user) router.push(loginUrlForBooking("basic"));
        else router.push("/booking?package=basic");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router, authLoading, profile?.role, user]);

  return (
    <>
      <div id="loader">
        <div className="loader-logo">LAUNDRA</div>
        <div className="loader-bar-track">
          <div className="loader-bar" id="loaderBar" />
        </div>
        <div className="loader-tagline">Calibrating the clean</div>
      </div>

      <div className="scroll-indicator" id="scrollIndicator" />

      {shell === "marketing" && <MarketingChrome />}
      {shell === "customer" && <CustomerChrome />}
      {shell === "rider" && <RiderChrome />}
      {shell === "auth" && <AuthChrome />}

      <div id="app" className={appClassName}>{children}</div>
    </>
  );
}
