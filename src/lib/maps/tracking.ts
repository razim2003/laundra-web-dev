import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LatLng } from "./geo";

export type TrackingPoint = LatLng & {
  booking_id?: string;
  rider_id?: string;
  created_at: string;
  heading_deg?: number | null;
  speed_mps?: number | null;
};

export function useBookingTracking(supabase: SupabaseClient | null, bookingId: string | null) {
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !bookingId) return;
    let mounted = true;
    const loadingTimer = window.setTimeout(() => setLoading(true), 0);

    supabase
      .from("booking_tracking")
      .select("lat,lng,heading_deg,speed_mps,created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true })
      .limit(60)
      .then(({ data }) => {
        if (!mounted) return;
        setPoints((data ?? []) as TrackingPoint[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`booking-tracking-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_tracking", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const next = payload.new as TrackingPoint;
          setPoints((prev) => [...prev.slice(-59), next]);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      window.clearTimeout(loadingTimer);
      supabase.removeChannel(channel);
    };
  }, [supabase, bookingId]);

  const latest = useMemo(() => (points.length ? points[points.length - 1] : null), [points]);

  return { points, latest, loading };
}

export function useAllTracking(supabase: SupabaseClient | null) {
  const [points, setPoints] = useState<TrackingPoint[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase
      .from("booking_tracking")
      .select("lat,lng,heading_deg,speed_mps,created_at,booking_id,rider_id")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!mounted) return;
        setPoints((data ?? []) as TrackingPoint[]);
      });

    const channel = supabase
      .channel("admin-tracking")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_tracking" },
        (payload) => {
          const next = payload.new as TrackingPoint;
          setPoints((prev) => [next, ...prev].slice(0, 200));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return points;
}
