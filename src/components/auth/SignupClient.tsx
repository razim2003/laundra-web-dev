"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AUTH_NEXT_STORAGE_KEY,
  clearStoredAuthNext,
  readSafeInternalPath,
  readStoredAuthNext,
} from "@/lib/auth-navigation";
import { isAuthBypassEnabled, isAuthPageDevEnabled } from "@/lib/auth-bypass";
import { useSupabaseUser } from "@/lib/supabase/session";

export default function SignupClient() {
  const { supabase, user, profile, loading, envError } = useSupabaseUser();
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search.get("next");
  const roleQs = search.get("role");

  const initialRole = useMemo(() => (roleQs === "rider" ? "rider" : "customer"), [roleQs]);
  const [roleTab, setRoleTab] = useState<"customer" | "rider">(initialRole);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setRoleTab(initialRole), 0);
    return () => window.clearTimeout(timer);
  }, [initialRole]);

  useEffect(() => {
    if (loading) return;
    if (isAuthPageDevEnabled()) return;

    const fromUrl = readSafeInternalPath(nextParam);
    const safeNext = fromUrl ?? readStoredAuthNext();

    if (isAuthBypassEnabled() && !user) {
      return;
    }

    if (user && profile) {
      if (safeNext) {
        clearStoredAuthNext();
        router.replace(safeNext);
        return;
      }
      clearStoredAuthNext();
      router.replace(profile.role === "rider" ? "/rider" : "/customer");
    }
  }, [loading, user, profile, router, nextParam]);

  const profilePending = !!user && !profile && !loading;

  const resetSession = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/signup");
  };

  const signUpWithPassword = async () => {
    setStatus("working");
    setError(null);
    if (!supabase) return;

    if (!username.trim() || !password) {
      setStatus("error");
      setError("Enter a username and password to continue.");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem("laundra_role", roleTab);
    }

    const n = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
    const safe = readSafeInternalPath(n);
    if (safe && typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_NEXT_STORAGE_KEY, safe);
    }

    const registerRes = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        role: roleTab,
        fullName,
        phone,
        email,
      }),
    });

    const registerData = (await registerRes.json()) as { authEmail?: string; error?: string };
    if (!registerRes.ok || !registerData.authEmail) {
      setStatus("error");
      setError(registerData.error ?? "Could not create account.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: registerData.authEmail,
      password,
    });
    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }

    setStatus("success");
  };

  if (isAuthPageDevEnabled()) {
    return (
      <div className="section-pad" style={{ paddingTop: 120, background: "var(--bg)" }}>
        <div className="section-inner">
          <div
            className="config-card animate-in"
            style={{
              maxWidth: 720,
              marginBottom: 18,
              borderColor: "var(--black)",
              background: "var(--yellow)",
            }}
          >
            <div className="config-title">Auth page — dev layout</div>
            <p style={{ fontFamily: "Inter", lineHeight: 1.6, opacity: 0.9, margin: 0 }}>
              Set <code>NEXT_PUBLIC_LAUDRA_AUTH_DEV</code> to false for the real signup flow.
            </p>
          </div>
          {envError && (
            <div style={{ color: "var(--red)", fontWeight: 800, marginTop: 16 }}>{envError}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="section-pad" style={{ paddingTop: 120, background: "var(--bg)" }}>
      <div className="section-inner">
        <div className="section-label animate-in">Account</div>
        <h2 className="section-title animate-in">
          Sign up
        </h2>

        <div className="config-card animate-in" style={{ maxWidth: 720 }}>
          {profilePending && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                border: "3px solid var(--black)",
                background: "white",
                boxShadow: "6px 6px 0 0 var(--black)",
                fontFamily: "Inter",
                lineHeight: 1.5,
              }}
            >
              <div className="config-title" style={{ marginBottom: 6 }}>
                Finishing your profile
              </div>
              <div style={{ fontSize: 14, marginBottom: 10 }}>
                We found a session but couldn&apos;t load your profile yet. If this keeps looping, reset the session.
              </div>
              <button className="btn-yellow" type="button" onClick={resetSession}>
                Reset session
              </button>
            </div>
          )}
          <div className="config-title">Create your profile</div>

          <p style={{ marginBottom: 16, fontFamily: "Inter", fontSize: 14, lineHeight: 1.55, opacity: 0.88 }}>
            New to Laundra? Register as a <strong>customer</strong> to book laundry, or as a <strong>rider</strong> to
            accept delivery jobs. Use a username and password to finish setup.
          </p>

          {envError && (
            <div style={{ color: "var(--red)", fontWeight: 800, marginBottom: 12 }}>{envError}</div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {(["customer", "rider"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRoleTab(option)}
                style={{
                  border: "3px solid var(--black)",
                  background: roleTab === option ? "var(--yellow)" : "white",
                  boxShadow: "4px 4px 0 0 var(--black)",
                  padding: "12px 14px",
                  fontFamily: "Space Grotesk",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {option === "customer" ? "Customer" : "Rider"}
              </button>
            ))}
          </div>

          <label
            style={{
              fontFamily: "Space Grotesk",
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 8,
              display: "block",
              opacity: 0.6,
            }}
          >
            Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            autoComplete="username"
            style={{
              width: "100%",
              border: "3px solid var(--black)",
              padding: "12px 14px",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 14,
              outline: "none",
              background: "white",
              marginBottom: 14,
            }}
          />

          <label
            style={{
              fontFamily: "Space Grotesk",
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 8,
              display: "block",
              opacity: 0.6,
            }}
          >
            Full name
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            style={{
              width: "100%",
              border: "3px solid var(--black)",
              padding: "12px 14px",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 14,
              outline: "none",
              background: "white",
              marginBottom: 14,
            }}
          />

          <label
            style={{
              fontFamily: "Space Grotesk",
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 8,
              display: "block",
              opacity: 0.6,
            }}
          >
            Phone (optional)
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+94 …"
            inputMode="tel"
            style={{
              width: "100%",
              border: "3px solid var(--black)",
              padding: "12px 14px",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 14,
              outline: "none",
              background: "white",
              marginBottom: 14,
            }}
          />

          <label
            style={{
              fontFamily: "Space Grotesk",
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 8,
              display: "block",
              opacity: 0.6,
            }}
          >
            Email (optional)
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            inputMode="email"
            style={{
              width: "100%",
              border: "3px solid var(--black)",
              padding: "12px 14px",
              fontFamily: "Space Grotesk",
              fontWeight: 700,
              fontSize: 13,
              textTransform: "uppercase",
              outline: "none",
              background: "white",
              marginBottom: 16,
            }}
          />

          <label
            style={{
              fontFamily: "Space Grotesk",
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 8,
              display: "block",
              opacity: 0.6,
            }}
          >
            Password
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            type="password"
            autoComplete="new-password"
            style={{
              width: "100%",
              border: "3px solid var(--black)",
              padding: "12px 14px",
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 14,
              outline: "none",
              background: "white",
              marginBottom: 16,
            }}
          />

          <button
            className="btn-yellow"
            type="button"
            onClick={signUpWithPassword}
            disabled={status === "working" || !supabase}
          >
            {status === "working" ? "Creating…" : "Create account"}
          </button>

          {status === "success" && (
            <div style={{ marginTop: 16, fontFamily: "Inter", fontSize: 13, fontWeight: 600 }}>
              Account created. Signing you in now.
            </div>
          )}
          {error && <div style={{ marginTop: 16, color: "var(--red)", fontWeight: 700 }}>{error}</div>}

          <p style={{ marginTop: 20, fontFamily: "Inter", fontSize: 13, lineHeight: 1.5, opacity: 0.75 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ fontWeight: 700, textDecoration: "underline" }}>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
