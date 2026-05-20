"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginUrlForBooking } from "@/lib/marketing-links";
import { useSupabaseUser } from "@/lib/supabase/session";

export default function MarketingChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const { supabase, user, profile } = useSupabaseUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCustomer = profile?.role === "customer";
  const isRider = profile?.role === "rider";
  const showBooking = !isRider;
  const showRiderCta = !user;

  const activeNav = useMemo(() => {
    if (pathname === "/booking") return "booking";
    if (pathname.startsWith("/track")) return "track";
    if (pathname.startsWith("/admin")) return "admin";
    if (pathname.startsWith("/login") || pathname.startsWith("/signup")) return "auth";
    return "home";
  }, [pathname]);

  const loginActive = pathname.startsWith("/login");
  const signupActive = pathname.startsWith("/signup");

  const closeMenu = () => setMobileMenuOpen(false);
  const signOut = async () => {
    closeMenu();
    await supabase?.auth.signOut();
    router.replace("/");
  };

  return (
    <>
      <nav
        className={`main-nav ${mobileMenuOpen ? "menu-open" : ""}`}
        id="mainNav"
      >
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
            <Link className="nav-link-muted" href="/#process" onClick={closeMenu}>
              How It Works
            </Link>
            <Link className="nav-link-muted" href="/#features" onClick={closeMenu}>
              Services
            </Link>
            <Link className="nav-link-muted" href="/#pricing" onClick={closeMenu}>
              Pricing
            </Link>
            <Link className="nav-link-muted" href="/#faq" onClick={closeMenu}>
              FAQ
            </Link>
            {showBooking && (
              <Link
                className="nav-link-muted"
                href={loginUrlForBooking("basic")}
                prefetch={false}
                onClick={closeMenu}
              >
                Book
              </Link>
            )}
            {user && isCustomer && (
              <Link className="nav-link-muted" href="/customer" onClick={closeMenu}>
                Orders
              </Link>
            )}
            {user && isRider && (
              <Link className="nav-link-muted" href="/rider" onClick={closeMenu}>
                Rider hub
              </Link>
            )}
            {!user && (
              <>
                <Link className="nav-link-muted" href="/signup" onClick={closeMenu}>
                  Sign up
                </Link>
                <Link className="nav-link-muted" href="/login" onClick={closeMenu}>
                  Sign in
                </Link>
              </>
            )}
          </div>
          <div className="nav-cta">
            {showRiderCta && (
              <Link className="btn-outline" href="/signup?role=rider" onClick={closeMenu}>
                Become a Rider
              </Link>
            )}
            {showBooking && (
              <Link className="btn-primary" href={loginUrlForBooking("basic")} prefetch={false} onClick={closeMenu}>
                Book Pickup
              </Link>
            )}
            {user && (
              <button className="btn-primary" type="button" onClick={() => void signOut()}>
                Sign out
              </button>
            )}
          </div>
        </div>
      </nav>

      <nav className="mobile-nav" aria-label="Marketing">
        <Link
          className={`mobile-nav-item ${activeNav === "home" ? "active" : ""}`}
          href="/"
        >
          <span className="material-symbols-outlined">home</span>Home
        </Link>
        {showBooking && (
          <Link
            className={`mobile-nav-item ${pathname.startsWith("/login") ? "active" : ""}`}
            href={loginUrlForBooking("basic")}
            prefetch={false}
          >
            <span className="material-symbols-outlined">add_box</span>Book
          </Link>
        )}
        {user && isCustomer && (
          <Link className="mobile-nav-item" href="/customer">
            <span className="material-symbols-outlined">receipt_long</span>Orders
          </Link>
        )}
        {user && isRider && (
          <Link className="mobile-nav-item" href="/rider">
            <span className="material-symbols-outlined">two_wheeler</span>Hub
          </Link>
        )}
        {!user && (
          <>
            <Link className={`mobile-nav-item ${signupActive ? "active" : ""}`} href="/signup">
              <span className="material-symbols-outlined">person_add</span>Join
            </Link>
            <Link className={`mobile-nav-item ${loginActive ? "active" : ""}`} href="/login">
              <span className="material-symbols-outlined">login</span>Sign in
            </Link>
          </>
        )}
        {user && (
          <button className="mobile-nav-item" type="button" onClick={() => void signOut()}>
            <span className="material-symbols-outlined">logout</span>Out
          </button>
        )}
      </nav>
    </>
  );
}
