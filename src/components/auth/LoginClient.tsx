"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AUTH_NEXT_STORAGE_KEY,
  clearStoredAuthNext,
  readSafeInternalPath,
  readStoredAuthNext,
} from "@/lib/auth-navigation";
import { identifierToAuthEmailCandidates } from "@/lib/auth-identity";
import { isAuthBypassEnabled, isAuthPageDevEnabled } from "@/lib/auth-bypass";
import { useSupabaseUser } from "@/lib/supabase/session";

export default function LoginClient() {
  const { supabase, user, profile, loading, envError } = useSupabaseUser();
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search.get("next");
  const resetMode = search.get("reset") === "1";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirm, setRecoveryConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAttemptAt, setLastAttemptAt] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (isAuthPageDevEnabled()) return;
    if (resetMode) return;

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
      const switchRider = search.get("switch") === "rider";
      if (switchRider && profile.role === "customer") {
        return;
      }
      clearStoredAuthNext();
      router.replace(profile.role === "rider" ? "/rider" : "/customer");
    }
  }, [loading, user, profile, router, nextParam, search, resetMode]);

  const profilePending = !!user && !profile && !loading;

  const resetSession = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const becomeRiderForCustomer = async () => {
    if (!supabase || !user) return;
    setError(null);
    const { error: profErr } = await supabase.from("profiles").update({ role: "rider" }).eq("id", user.id);
    if (profErr) {
      setError(profErr.message);
      return;
    }
    const { error: riderErr } = await supabase.from("riders").upsert({ id: user.id }, { onConflict: "id" });
    if (riderErr) {
      setError(riderErr.message);
      return;
    }
    router.replace("/rider");
  };

  const signInWithPassword = async () => {
    setStatus("working");
    setError(null);
    setSuccess(null);
    if (!supabase) return;

    if (!identifier.trim() || !password) {
      setStatus("error");
      setError("Enter your username and password to continue.");
      return;
    }

    const n = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
    const safe = readSafeInternalPath(n);
    if (safe && typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_NEXT_STORAGE_KEY, safe);
    }

    let signInError: { message: string; status?: number } | null = null;
    for (const email of identifierToAuthEmailCandidates(identifier)) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      signInError = error;
      if (!error) break;
    }
    if (signInError) {
      if (signInError.status === 400) {
        setError("Username/password login is not enabled or credentials are invalid.");
      } else {
        setError(signInError.message);
      }
      setStatus("error");
      return;
    }

    setStatus("success");
  };

  const sendPasswordReset = async () => {
    setStatus("working");
    setError(null);
    setSuccess(null);

    if (!supabase) return;
    if (!identifier.trim()) {
      setStatus("error");
      setError("Enter your email or username first.");
      return;
    }

    const [email] = identifierToAuthEmailCandidates(identifier);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=1`,
    });

    if (resetError) {
      setStatus("error");
      setError(resetError.message);
      return;
    }

    setStatus("success");
    setSuccess("Password reset link sent if that account can receive email.");
  };

  const updateRecoveryPassword = async () => {
    setStatus("working");
    setError(null);
    setSuccess(null);

    if (!supabase) return;
    if (recoveryPassword.length < 6) {
      setStatus("error");
      setError("New password must be at least 6 characters.");
      return;
    }
    if (recoveryPassword !== recoveryConfirm) {
      setStatus("error");
      setError("Password confirmation does not match.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: recoveryPassword });
    if (updateError) {
      setStatus("error");
      setError(updateError.message);
      return;
    }

    setRecoveryPassword("");
    setRecoveryConfirm("");
    setStatus("success");
    setSuccess("Password updated. You can continue to your dashboard.");
  };

  const signInDemo = async () => {
    if (!supabase) return;
    const now = Date.now();
    if (lastAttemptAt && now - lastAttemptAt < 4000) {
      setError("Please wait a moment before trying again.");
      setStatus("error");
      return;
    }
    setLastAttemptAt(now);
    setStatus("working");
    setError(null);
    setSuccess(null);

    const demoEmail = "demo.customer@laundra.test";
    const demoPassword = "LaundraDemo123!";

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });

    if (!signInError) {
      setStatus("success");
      return;
    }
    if (signInError.status === 400) {
      setError("Demo user is not created or password login is disabled. Create the demo user in Supabase Auth.");
    } else if (signInError.status === 429) {
      setError("Too many attempts. Wait a minute and try again.");
    } else {
      setError(signInError.message);
    }
    setStatus("error");
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
              Set <code>NEXT_PUBLIC_LAUDRA_AUTH_DEV</code> to false for the real login flow.
            </p>
          </div>
          {envError && (
            <div style={{ color: "var(--red)", fontWeight: 800, marginTop: 16 }}>{envError}</div>
          )}
        </div>
      </div>
    );
  }

  const showRiderSwitch = user && profile?.role === "customer" && search.get("switch") === "rider";
  const wantsRider = search.get("switch") === "rider";
  const resumeBooking = readSafeInternalPath(nextParam)?.startsWith("/booking") ?? false;

  return (
    <div className="section-pad" style={{ paddingTop: 120, background: "var(--bg)" }}>
      <div className="section-inner">
        <div className="section-label animate-in">Account</div>
        <h2 className="section-title animate-in">
          {resetMode ? "Reset password" : "Log in"}
        </h2>

        <div className="config-card animate-in" style={{ maxWidth: 720 }}>
          {resetMode && user && (
            <div
              style={{
                marginBottom: 22,
                padding: "16px",
                border: "3px solid var(--black)",
                background: "rgba(255, 204, 0, 0.22)",
                boxShadow: "5px 5px 0 0 var(--black)",
              }}
            >
              <div className="config-title" style={{ marginBottom: 14 }}>
                Set new password
              </div>
              <div className="profile-settings-grid">
                <div>
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
                    New password
                  </label>
                  <input
                    value={recoveryPassword}
                    onChange={(e) => setRecoveryPassword(e.target.value)}
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
                    }}
                  />
                </div>
                <div>
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
                    Confirm password
                  </label>
                  <input
                    value={recoveryConfirm}
                    onChange={(e) => setRecoveryConfirm(e.target.value)}
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
                    }}
                  />
                </div>
              </div>
              <button
                className="btn-yellow"
                type="button"
                onClick={updateRecoveryPassword}
                disabled={status === "working" || !supabase}
              >
                {status === "working" ? "Updating..." : "Update password"}
              </button>
            </div>
          )}

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
          <div className="config-title">Username</div>

          {envError && (
            <div style={{ color: "var(--red)", fontWeight: 800, marginBottom: 12 }}>{envError}</div>
          )}

          {showRiderSwitch && (
            <div
              style={{
                marginBottom: 20,
                padding: "14px 16px",
                border: "3px solid var(--black)",
                background: "white",
                boxShadow: "6px 6px 0 0 var(--black)",
              }}
            >
              <div className="config-title" style={{ marginBottom: 8 }}>
                Rider portal
              </div>
              <div style={{ marginBottom: 12, fontFamily: "Inter", lineHeight: 1.5 }}>
                You are signed in as a customer. Confirm to enable rider mode on this account.
              </div>
              <button className="btn-yellow" type="button" onClick={becomeRiderForCustomer}>
                Become a rider
              </button>
            </div>
          )}

          {resumeBooking && (
            <p
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                border: "3px solid var(--primary)",
                background: "rgba(0, 90, 180, 0.06)",
                fontFamily: "Inter",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              You&apos;re signing in to continue a pickup booking. After you log in, we&apos;ll take you straight to
              booking.
            </p>
          )}

          <p style={{ marginBottom: 14, fontFamily: "Inter", fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
            After you sign in, we send you to the right dashboard from your account type.
          </p>

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
            Username or email
          </label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="your username"
            autoComplete="username"
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
            placeholder="Your password"
            type="password"
            autoComplete="current-password"
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
            onClick={signInWithPassword}
            disabled={status === "working" || !supabase}
          >
            {status === "working" ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={sendPasswordReset}
            disabled={status === "working" || !supabase}
            style={{
              marginLeft: 14,
              border: "none",
              background: "transparent",
              fontFamily: "Space Grotesk",
              fontWeight: 900,
              fontSize: 12,
              textTransform: "uppercase",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Forgot password?
          </button>

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <button
              type="button"
              onClick={signInDemo}
              disabled={status === "working" || !supabase}
              style={{
                border: "3px solid var(--black)",
                background: "white",
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
              {status === "working" ? "Preparing demo…" : "Use demo customer"}
            </button>
          </div>

          {success && (
            <div style={{ marginTop: 16, fontFamily: "Inter", fontSize: 13, fontWeight: 600 }}>{success}</div>
          )}
          {error && <div style={{ marginTop: 16, color: "var(--red)", fontWeight: 700 }}>{error}</div>}

          <p style={{ marginTop: 20, fontFamily: "Inter", fontSize: 13, lineHeight: 1.5, opacity: 0.75 }}>
            New here?{" "}
            <Link href={wantsRider ? "/signup?role=rider" : "/signup"} style={{ fontWeight: 700, textDecoration: "underline" }}>
              {wantsRider ? "Create a rider account" : "Create an account"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
