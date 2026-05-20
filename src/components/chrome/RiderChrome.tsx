"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSupabaseUser } from "@/lib/supabase/session";

export default function RiderChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const { supabase } = useSupabaseUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeNav = useMemo(() => (pathname.startsWith("/rider") ? "rider" : "other"), [pathname]);
  const closeMenu = () => setMobileMenuOpen(false);

  const signOut = async () => {
    await supabase?.auth.signOut();
    router.replace("/login");
  };

  return (
    <>
      <nav className={`main-nav ${mobileMenuOpen ? "menu-open" : ""}`} id="mainNav">
        <Link className="nav-logo hover-line" href="/" onClick={closeMenu}>
          LAUNDRA
        </Link>
        <button
          type="button"
          className="hamburger"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileMenuOpen((o) => !o)}
        />
        <div className="nav-middle">
          <div className="nav-links">
            <Link className={activeNav === "rider" ? "active" : ""} href="/rider" prefetch onClick={closeMenu}>
              Rider hub
            </Link>
            <Link href="/rider#rider-jobs" onClick={closeMenu}>
              Jobs
            </Link>
            <Link href="/" onClick={closeMenu}>
              Website
            </Link>
          </div>
          <div className="nav-cta">
            <Link className="btn-outline" href="/" onClick={closeMenu}>
              Home
            </Link>
            <button className="btn-primary" type="button" onClick={() => { closeMenu(); void signOut(); }}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <nav className="mobile-nav" aria-label="Rider">
        <Link className={`mobile-nav-item ${activeNav === "rider" ? "active" : ""}`} href="/rider" prefetch>
          <span className="material-symbols-outlined">two_wheeler</span>Hub
        </Link>
        <Link className="mobile-nav-item" href="/rider#rider-jobs">
          <span className="material-symbols-outlined">list_alt</span>Jobs
        </Link>
        <Link className="mobile-nav-item" href="/">
          <span className="material-symbols-outlined">public</span>Site
        </Link>
        <button className="mobile-nav-item" type="button" onClick={() => void signOut()}>
          <span className="material-symbols-outlined">logout</span>Out
        </button>
      </nav>
    </>
  );
}
