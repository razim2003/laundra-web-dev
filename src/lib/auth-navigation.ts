export const AUTH_NEXT_STORAGE_KEY = "laundra_auth_next";

export function readSafeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export function readStoredAuthNext(): string | null {
  if (typeof window === "undefined") return null;
  return readSafeInternalPath(window.localStorage.getItem(AUTH_NEXT_STORAGE_KEY));
}

export function clearStoredAuthNext() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
  }
}
