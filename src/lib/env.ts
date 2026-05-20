import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_OSRM_API: z.string().url().optional(),
  NEXT_PUBLIC_NOMINATIM_API: z.string().url().optional(),
});

const normalizeEnvValue = (value: string | undefined) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

/**
 * IMPORTANT:
 * - Do not throw at module-eval time (breaks `next build` when env isn't set yet).
 * - Validate when the env is actually needed.
 */
export function getPublicEnv() {
  const candidate = {
    NEXT_PUBLIC_SUPABASE_URL: normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_OSRM_API: normalizeEnvValue(process.env.NEXT_PUBLIC_OSRM_API),
    NEXT_PUBLIC_NOMINATIM_API: normalizeEnvValue(process.env.NEXT_PUBLIC_NOMINATIM_API),
  };

  const parsed = publicSchema.safeParse(candidate);
  if (!parsed.success) {
    const msg =
      "Missing/invalid env. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (see `.env.example`).";
    // In the browser, fail loudly so the UI can present a real error state.
    if (typeof window !== "undefined") throw new Error(msg);
    // On the server during build/prerender, return a harmless placeholder.
    return {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "missing",
      NEXT_PUBLIC_OSRM_API: process.env.NEXT_PUBLIC_OSRM_API,
      NEXT_PUBLIC_NOMINATIM_API: process.env.NEXT_PUBLIC_NOMINATIM_API,
    };
  }
  return parsed.data;
}

