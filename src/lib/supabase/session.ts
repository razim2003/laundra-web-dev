"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./browser";

type UserProfile = {
  id: string;
  role: "customer" | "rider" | "admin";
  full_name: string | null;
  phone: string | null;
};

async function ensureRiderRow(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from("riders").upsert({ id: userId }, { onConflict: "id" });
  if (error) console.warn("[laundra] ensureRiderRow:", error.message);
}

export function useSupabaseUser() {
  const [clientInit] = useState(() => {
    try {
      return {
        supabase: createSupabaseBrowserClient() as SupabaseClient,
        envError: null as string | null,
      };
    } catch (e: unknown) {
      return {
        supabase: null,
        envError: e instanceof Error ? e.message : "Supabase is not configured.",
      };
    }
  });
  const supabase = clientInit.supabase;
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(!supabase);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const envError = clientInit.envError;

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthResolved(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthResolved(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;

    if (!user) {
      const timer = window.setTimeout(() => {
        setProfile(null);
        setProfileLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let mounted = true;

    const syncProfile = async () => {
      setProfileLoading(true);

      const meta = user.user_metadata as { role?: string; full_name?: string; phone?: string } | undefined;
      const metaRole =
        meta?.role === "rider" || meta?.role === "customer" || meta?.role === "admin"
          ? meta.role
          : null;

      const pendingRaw =
        typeof window !== "undefined" ? window.localStorage.getItem("laundra_role") : null;
      const pendingRole =
        pendingRaw === "rider" || pendingRaw === "customer" || pendingRaw === "admin"
          ? pendingRaw
          : null;

      const { data: existing, error: fetchError } = await supabase
        .from("profiles")
        .select("id,role,full_name,phone")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (fetchError) {
        console.error(fetchError);
        if (mounted) {
          setProfile(null);
          setProfileLoading(false);
        }
        return;
      }

      let resolved = existing as UserProfile | null;

      const desiredRole = pendingRole ?? metaRole;

      if (!resolved) {
        const role = (desiredRole === "rider" || desiredRole === "admin" ? desiredRole : "customer") as
          | "customer"
          | "rider"
          | "admin";
        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            role,
            full_name: meta?.full_name ?? null,
            phone: meta?.phone ?? null,
          })
          .select("id,role,full_name,phone")
          .single();

        if (!mounted) return;

        if (!insertError && inserted) {
          resolved = inserted as UserProfile;
          if (resolved.role === "rider") await ensureRiderRow(supabase, user.id);
        }
      } else if (resolved.role === "rider") {
        await ensureRiderRow(supabase, user.id);
      }

      if (resolved && meta?.phone && !resolved.phone) {
        const { data: patched } = await supabase
          .from("profiles")
          .update({ phone: meta.phone })
          .eq("id", user.id)
          .select("id,role,full_name,phone")
          .single();
        if (patched) resolved = patched as UserProfile;
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("laundra_role");
      }

      if (mounted) {
        setProfile(resolved);
        setProfileLoading(false);
      }
    };

    syncProfile();

    return () => {
      mounted = false;
    };
  }, [supabase, user]);

  return {
    supabase,
    user,
    profile,
    loading: !authResolved || profileLoading,
    envError,
  };
}
