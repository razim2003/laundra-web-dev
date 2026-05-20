import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizeUsername, usernameToAuthEmail } from "@/lib/auth-identity";
import { getPublicEnv } from "@/lib/env";

const registerSchema = z.object({
  username: z.string().min(3).max(40),
  password: z.string().min(6),
  role: z.enum(["customer", "rider"]).default("customer"),
  fullName: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid registration request." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a username and a password of at least 6 characters." }, { status: 400 });
  }

  const username = normalizeUsername(parsed.data.username);
  if (username.length < 3) {
    return NextResponse.json({ error: "Username must contain at least 3 letters or numbers." }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server auth is not configured." }, { status: 500 });
  }

  const env = getPublicEnv();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const authEmail = usernameToAuthEmail(username);
  const displayName = parsed.data.fullName?.trim() || username;
  const contactEmail = parsed.data.email?.trim() || null;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      username,
      role: parsed.data.role,
      full_name: displayName,
      phone: parsed.data.phone?.trim() || null,
      contact_email: contactEmail,
    },
  });

  if (createError || !created.user) {
    const message = createError?.message.toLowerCase().includes("already")
      ? "That username is already taken."
      : createError?.message ?? "Could not create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      role: parsed.data.role,
      full_name: displayName,
      phone: parsed.data.phone?.trim() || null,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (parsed.data.role === "rider") {
    const { error: riderError } = await admin.from("riders").upsert({ id: created.user.id }, { onConflict: "id" });
    if (riderError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: riderError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ authEmail });
}
