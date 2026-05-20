/**
 * When true: middleware does not redirect to `/login`, and some client pages show preview-only UI.
 * **Default is off** — users must sign in; booking and dashboards are protected.
 *
 * - `NEXT_PUBLIC_LAUDRA_SKIP_AUTH=true` / `1` / `yes` → skip middleware auth redirects (local UI testing only).
 * - Anything else (unset, false, 0, no) → enforce auth in development and production.
 *
 * Database writes still require a signed-in user (Supabase RLS).
 */
export function isAuthBypassEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_LAUDRA_SKIP_AUTH?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Local only: stay on `/login` / `/signup`, hide magic-link UI, no client redirects — use while building the auth page layout. */
export function isAuthPageDevEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_LAUDRA_AUTH_DEV?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
