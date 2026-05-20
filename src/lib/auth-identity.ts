const USERNAME_EMAIL_DOMAIN = "users.laundra.example.com";
const LEGACY_USERNAME_EMAIL_DOMAIN = "users.laundra.local";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function usernameToAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}

export function usernameToLegacyAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@${LEGACY_USERNAME_EMAIL_DOMAIN}`;
}

export function identifierToAuthEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  return value.includes("@") ? value : usernameToAuthEmail(value);
}

export function identifierToAuthEmailCandidates(identifier: string): string[] {
  const value = identifier.trim().toLowerCase();
  if (value.includes("@")) return [value];

  const username = normalizeUsername(value);
  return [usernameToAuthEmail(username), usernameToLegacyAuthEmail(username)];
}
