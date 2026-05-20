"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AuthChrome() {
  const pathname = usePathname();
  const onLogin = pathname.startsWith("/login") || pathname === "/auth";
  const onSignup = pathname.startsWith("/signup");

  return (
    <nav className="main-nav" id="mainNav">
      <Link className="nav-logo hover-line" href="/" prefetch={false}>
        LAUNDRA
      </Link>
      <div className="nav-middle" style={{ flex: 1, justifyContent: "flex-end" }}>
        <div className="nav-links">
          <Link href="/" prefetch={false} className={!onLogin && !onSignup ? "active" : ""}>
            Website
          </Link>
          <Link href="/login" prefetch={false} className={onLogin ? "active" : ""}>
            Log in
          </Link>
          <Link href="/signup" prefetch={false} className={onSignup ? "active" : ""}>
            Sign up
          </Link>
        </div>
      </div>
    </nav>
  );
}
