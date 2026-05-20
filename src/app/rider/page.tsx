"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LaundraRouteLoader from "@/components/LaundraRouteLoader";
import ProfileSettings from "@/components/auth/ProfileSettings";
import { isAuthBypassEnabled } from "@/lib/auth-bypass";
import { useSupabaseUser } from "@/lib/supabase/session";

function formatLKR(amount: number) {
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

type BookingJob = {
  id: string;
  service_type: string | null;
  pickup_address: string | null;
  pickup_city: string | null;
  total_lkr: number | null;
  scheduled_date: string | null;
  scheduled_window: string | null;
  status: string | null;
};

const RIDER_STATUS_ACTIONS = [
  { status: "picked_up", label: "Picked" },
  { status: "out_for_delivery", label: "Ready to deliver" },
  { status: "delivered", label: "Delivered" },
] as const;

function statusLabel(status: string | null) {
  if (status === "rider_assigned") return "Accepted";
  if (status === "picked_up") return "Picked";
  if (status === "out_for_delivery") return "Ready to deliver";
  if (status === "delivered") return "Delivered";
  return (status ?? "Booking").replaceAll("_", " ");
}

const RiderOperationsMap = dynamic(() => import("@/components/maps/RiderOperationsMap"), {
  ssr: false,
  loading: () => <LaundraRouteLoader title="Map" subtitle="Loading route map…" variant="compact" />,
});

export default function RiderPage() {
  const { supabase, user, profile, loading: authLoading } = useSupabaseUser();
  const router = useRouter();
  const [navHash, setNavHash] = useState("");
  const [jobs, setJobs] = useState<BookingJob[]>([]);
  const [activeJobs, setActiveJobs] = useState<BookingJob[]>([]);
  const [historyJobs, setHistoryJobs] = useState<BookingJob[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [accepting, setAccepting] = useState<Record<string, boolean>>({});
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [riderRating, setRiderRating] = useState(5);
  const [riderReviewCount, setRiderReviewCount] = useState(0);
  const [deliveryCelebration, setDeliveryCelebration] = useState<BookingJob | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!supabase || !user) return;
      if (!opts?.silent) setLoading(true);
      setError(null);

      const select = "id,service_type,pickup_address,pickup_city,total_lkr,scheduled_date,scheduled_window,status";
      const [available, active, history] = await Promise.all([
        supabase
          .from("bookings")
          .select(select)
          .eq("status", "booking_placed")
          .is("rider_id", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select(select)
          .eq("rider_id", user.id)
          .in("status", ["rider_assigned", "rider_arriving", "picked_up", "out_for_delivery"])
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select(select)
          .eq("rider_id", user.id)
          .eq("status", "delivered")
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      const loadError = available.error ?? active.error ?? history.error;
      if (loadError) {
        setError(loadError.message);
        setJobs([]);
        setActiveJobs([]);
        setHistoryJobs([]);
      } else {
        setJobs((available.data ?? []) as BookingJob[]);
        setActiveJobs((active.data ?? []) as BookingJob[]);
        setHistoryJobs((history.data ?? []) as BookingJob[]);
      }
      if (!opts?.silent) setLoading(false);
    },
    [supabase, user],
  );

  useEffect(() => {
    if (!authLoading && isAuthBypassEnabled() && !user) {
      router.replace("/login?switch=rider");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!supabase) return;
    if (authLoading) return;

    if (isAuthBypassEnabled() && !user) {
      const timer = window.setTimeout(() => {
        setLoading(false);
        setJobs([]);
        setActiveJobs([]);
        setHistoryJobs([]);
        setError(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (!isAuthBypassEnabled() && !user) {
      return;
    }

    const fetchTimer = window.setTimeout(() => {
      fetchJobs();
    }, 0);
    const channel = supabase
      .channel("rider-available-bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => fetchJobs({ silent: true }),
      )
      .subscribe();

    return () => {
      window.clearTimeout(fetchTimer);
      supabase.removeChannel(channel);
    };
  }, [supabase, user, authLoading, fetchJobs]);

  useEffect(() => {
    if (!supabase || !user || authLoading) return;

    let cancelled = false;
    const loadRating = async () => {
      const [{ data: rider }, { data: reviews }] = await Promise.all([
        supabase.from("riders").select("rating").eq("id", user.id).maybeSingle(),
        supabase.from("rider_reviews").select("rating").eq("rider_id", user.id),
      ]);

      if (cancelled) return;
      const ratings = (reviews ?? []) as { rating: number }[];
      if (rider?.rating) setRiderRating(Number(rider.rating));
      else if (ratings.length) setRiderRating(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length);
      setRiderReviewCount(ratings.length);
    };

    loadRating();
    return () => {
      cancelled = true;
    };
  }, [supabase, user, authLoading]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const syncHash = () => setNavHash(typeof window !== "undefined" ? window.location.hash.slice(1) : "");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  const nearbyOrders = useMemo(
    () =>
      jobs.map((job) => ({
        label: job.service_type ?? "Booking",
        pickup: job.pickup_address ?? "Pickup address pending",
        city: job.pickup_city || "Colombo",
      })),
    [jobs],
  );
  const completedJobsCount = historyJobs.length;
  const totalEarnings = useMemo(
    () => historyJobs.reduce((sum, job) => sum + (job.total_lkr ?? 0), 0),
    [historyJobs],
  );

  const handleAccept = async (job: BookingJob) => {
    if (!supabase || !user) return;
    setAccepting((prev) => ({ ...prev, [job.id]: true }));
    setError(null);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ rider_id: user.id, status: "rider_assigned" })
      .eq("id", job.id);

    if (updateError) {
      setError(updateError.message);
      setAccepting((prev) => ({ ...prev, [job.id]: false }));
      return;
    }

    const { error: eventError } = await supabase.from("booking_events").insert({
      booking_id: job.id,
      status: "rider_assigned",
      note: "Rider accepted the booking.",
    });

    if (eventError) {
      setError(eventError.message);
    }

    await fetchJobs({ silent: true });
    setAccepted((prev) => ({ ...prev, [job.id]: true }));
    setAccepting((prev) => ({ ...prev, [job.id]: false }));
    setToast("Job accepted successfully.");
  };

  const updateJobStatus = async (job: BookingJob, status: (typeof RIDER_STATUS_ACTIONS)[number]["status"]) => {
    if (!supabase || !user) return;
    setUpdating((prev) => ({ ...prev, [job.id]: true }));
    setError(null);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", job.id)
      .eq("rider_id", user.id);

    if (updateError) {
      setError(updateError.message);
      setUpdating((prev) => ({ ...prev, [job.id]: false }));
      return;
    }

    const { error: eventError } = await supabase.from("booking_events").insert({
      booking_id: job.id,
      status,
      note: `Rider marked order as ${statusLabel(status)}.`,
      created_by: user.id,
    });

    if (eventError) setError(eventError.message);

    await fetchJobs({ silent: true });
    setUpdating((prev) => ({ ...prev, [job.id]: false }));
    if (status === "delivered") {
      setDeliveryCelebration(job);
      window.setTimeout(() => setDeliveryCelebration(null), 3600);
    }
    setToast(status === "delivered" ? "Delivery completed. Job moved to history." : `Status updated: ${statusLabel(status)}.`);
  };

  const bypass = isAuthBypassEnabled();

  if (!bypass && authLoading) {
    return (
      <div id="page-rider-loading" className="page-section active">
        <LaundraRouteLoader title="Rider portal" subtitle="Preparing your workspace…" />
      </div>
    );
  }

  if (!bypass && !authLoading && !user) {
    return (
      <div id="page-rider-auth" className="page-section active">
        <LaundraRouteLoader title="Rider portal" subtitle="Redirecting to sign in…" />
      </div>
    );
  }

  if (!bypass && !authLoading && user && !profile) {
    return (
      <div id="page-rider-profile" className="page-section active">
        <LaundraRouteLoader title="Rider portal" subtitle="Loading your rider profile…" />
      </div>
    );
  }

  if (!bypass && !authLoading && user && profile?.role === "customer") {
    return (
      <div id="page-rider-denied" className="page-section active">
        <LaundraRouteLoader
          title="Rider portal"
          subtitle="This account is a customer profile. Switch to a rider account to continue."
        />
      </div>
    );
  }

  return (
    <div id="page-rider" className="page-section active">
      {deliveryCelebration && (
        <div className="rider-win-overlay" role="status" aria-live="polite">
          <div className="rider-win-card">
            <div className="rider-win-burst" aria-hidden />
            <div className="rider-win-icon">
              <span className="material-symbols-outlined">verified</span>
            </div>
            <div className="rider-win-kicker">Delivery complete</div>
            <div className="rider-win-title">Nice work.</div>
            <div className="rider-win-meta">
              {deliveryCelebration.service_type ?? "Laundry"} · {deliveryCelebration.pickup_city ?? "Colombo"} ·{" "}
              {formatLKR(deliveryCelebration.total_lkr ?? 0)}
            </div>
          </div>
        </div>
      )}
      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">LAUNDRA</div>
          <Link className="sidebar-link" href="/">
            <span className="material-symbols-outlined">arrow_back</span> Back to Site
          </Link>
          <a
            className={`sidebar-link ${!navHash || navHash === "rider-stats" ? "active" : ""}`}
            href="#rider-stats"
          >
            <span className="material-symbols-outlined">grid_view</span> Dashboard
          </a>
          <a
            className={`sidebar-link ${navHash === "rider-route" ? "active" : ""}`}
            href="#rider-route"
          >
            <span className="material-symbols-outlined">map</span> My Route
          </a>
          <a
            className={`sidebar-link ${navHash === "rider-jobs" ? "active" : ""}`}
            href="#rider-jobs"
          >
            <span className="material-symbols-outlined">list_alt</span> Available Jobs
          </a>
          <a
            className={`sidebar-link ${navHash === "rider-history" ? "active" : ""}`}
            href="#rider-history"
          >
            <span className="material-symbols-outlined">history</span> History
          </a>
          <a
            className={`sidebar-link ${navHash === "rider-earnings" ? "active" : ""}`}
            href="#rider-earnings"
          >
            <span className="material-symbols-outlined">payments</span> Earnings
          </a>
          <a
            className={`sidebar-link ${navHash === "rider-settings" ? "active" : ""}`}
            href="#rider-settings"
            style={{ marginTop: "auto" }}
          >
            <span className="material-symbols-outlined">settings</span> Settings
          </a>
        </aside>

        <main className="dash-main">
          <div className="dash-header">Rider Portal</div>

          {toast && (
            <div
              style={{
                marginBottom: 18,
                border: "3px solid var(--black)",
                background: "var(--yellow)",
                boxShadow: "6px 6px 0 0 var(--black)",
                padding: "12px 16px",
                fontFamily: "Space Grotesk",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {toast}
            </div>
          )}

          {toast && (
            <div
              style={{
                marginBottom: 18,
                border: "3px solid var(--black)",
                background: "var(--yellow)",
                padding: "12px 16px",
                fontFamily: "Space Grotesk",
                fontWeight: 800,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Preview mode: navbar & screens work · jobs need a signed-in rider account
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 18,
                border: "3px solid var(--black)",
                background: "#ffe5e5",
                boxShadow: "6px 6px 0 0 var(--black)",
                padding: "12px 16px",
                fontFamily: "Space Grotesk",
                fontWeight: 800,
              }}
            >
              {error}
            </div>
          )}

          <div className="stat-grid" id="rider-stats" style={{ scrollMarginTop: 100 }}>
            <div
              className="stat-card"
              style={{
                background: "#d6e3ff",
                borderColor: "var(--primary)",
                boxShadow: "8px 8px 0 0 var(--primary)",
              }}
            >
              <div className="stat-label">Jobs Completed</div>
              <div className="stat-value">{completedJobsCount}</div>
              <div className="stat-trend">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "14px", verticalAlign: "middle" }}
                >
                  trending_up
                </span>{" "}
                Delivered jobs
              </div>
            </div>
            <div
              className="stat-card"
              id="rider-earnings"
              style={{
                background: "white",
                borderColor: "var(--black)",
                boxShadow: "8px 8px 0 0 var(--black)",
              }}
            >
              <div className="stat-label">Total Earnings</div>
              <div className="stat-value">{formatLKR(totalEarnings)}</div>
              <div className="stat-trend">From delivered orders</div>
            </div>
            <div
              className="stat-card"
              style={{
                background: "var(--tertiary)",
                borderColor: "var(--black)",
                boxShadow: "8px 8px 0 0 var(--black)",
                color: "white",
              }}
            >
              <div className="stat-label">Your Rating</div>
              <div className="stat-value">
                {riderRating.toFixed(1)}<span style={{ fontSize: 24, opacity: 0.5 }}>/5</span>
              </div>
              <div className="stat-trend" style={{ color: "var(--yellow)" }}>
                {"★".repeat(Math.round(riderRating)).padEnd(5, "☆")} · {riderReviewCount} reviews
              </div>
            </div>
          </div>

          <div
            id="rider-jobs"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 24,
              borderBottom: "4px solid var(--primary)",
              paddingBottom: 12,
              scrollMarginTop: 100,
            }}
          >
            <h3
              style={{
                fontFamily: "Space Grotesk",
                fontSize: 32,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
              }}
            >
              Available Jobs
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "Space Grotesk",
                fontWeight: 800,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                opacity: 0.6,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                filter_list
              </span>
              Filter
            </div>
          </div>

          <div id="rider-route" style={{ marginBottom: 32, scrollMarginTop: 100 }}>
            <div
              style={{
                fontFamily: "Space Grotesk",
                fontSize: 24,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                marginBottom: 16,
              }}
            >
              Live Route
            </div>
            <RiderOperationsMap nearbyOrders={nearbyOrders} />
          </div>

          <div
            id="rider-active"
            style={{
              marginBottom: 32,
              border: "4px solid var(--black)",
              background: "#fffef5",
              boxShadow: "8px 8px 0 0 var(--yellow)",
              padding: 22,
              scrollMarginTop: 100,
            }}
          >
            <div className="config-title" style={{ marginBottom: 14 }}>
              Active deliveries
            </div>
            {!activeJobs.length && (
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 800, opacity: 0.75 }}>
                No picked or accepted jobs yet.
              </div>
            )}
            {!!activeJobs.length && (
              <div style={{ display: "grid", gap: 14 }}>
                {activeJobs.map((job) => {
                  const currentIndex = RIDER_STATUS_ACTIONS.findIndex((a) => a.status === job.status);
                  return (
                    <div
                      key={`active-${job.id}`}
                      style={{
                        border: "3px solid var(--black)",
                        background: "white",
                        boxShadow: "4px 4px 0 0 var(--black)",
                        padding: 16,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div className="job-type-badge">{statusLabel(job.status)}</div>
                          <div style={{ marginTop: 10, fontFamily: "Space Grotesk", fontWeight: 900, textTransform: "uppercase" }}>
                            {job.service_type ?? "Laundry"} · {job.pickup_city ?? "Colombo"}
                          </div>
                          <div style={{ marginTop: 4, fontFamily: "Inter", fontSize: 13, opacity: 0.78 }}>
                            {job.pickup_address ?? "Pickup address pending"}
                          </div>
                        </div>
                        <div className="job-price">{formatLKR(job.total_lkr ?? 0)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                        {RIDER_STATUS_ACTIONS.map((action, idx) => (
                          <button
                            key={action.status}
                            className={action.status === "delivered" ? "btn-black" : "btn-yellow"}
                            type="button"
                            onClick={() => updateJobStatus(job, action.status)}
                            disabled={!!updating[job.id] || idx <= currentIndex}
                            style={{
                              fontSize: 11,
                              padding: "10px 14px",
                              opacity: idx <= currentIndex || updating[job.id] ? 0.55 : 1,
                            }}
                          >
                            {updating[job.id] ? "Updating..." : action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="jobs-grid" id="jobsGrid" style={{ scrollMarginTop: 100 }}>
            {loading && (
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 800 }}>
                Loading jobs...
              </div>
            )}
            {!loading && jobs.length === 0 && (
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 800 }}>
                No available jobs right now.
              </div>
            )}
            {jobs.map((job) => {
              const isAccepted = !!accepted[job.id];
              const isAccepting = !!accepting[job.id];
              const shadow = job.status === "booking_placed" ? "shadow-blue" : "shadow-yellow";
              return (
                <div className={`job-card ${shadow}`} key={job.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 16,
                    }}
                  >
                    <div className="job-type-badge">{job.service_type ?? "Laundry"}</div>
                    <div className="job-price">
                      {formatLKR(job.total_lkr ?? 0)}
                    </div>
                  </div>
                  <div className="job-route">
                    <div className="job-point">
                      <div className="job-point-icon">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" }}
                        >
                          location_on
                        </span>
                      </div>
                      <div>
                        <div className="job-point-label">Pickup</div>
                        <div className="job-point-addr">
                          {job.pickup_address ?? "Pickup address pending"}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        width: 2,
                        height: 20,
                        background: "var(--primary)",
                      }}
                    />
                    <div className="job-point">
                      <div className="job-point-icon" style={{ background: "white" }}>
                        <span className="material-symbols-outlined">inventory_2</span>
                      </div>
                      <div>
                        <div className="job-point-label">Drop-off</div>
                        <div className="job-point-addr">
                          Laundra Hub · {job.pickup_city ?? "Colombo"}
                        </div>
                      </div>
                    </div>
                  </div>
                  {(job.scheduled_date || job.scheduled_window) && (
                    <div
                      style={{
                        marginTop: 12,
                        fontFamily: "Space Grotesk",
                        fontWeight: 800,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        opacity: 0.7,
                      }}
                    >
                      {job.scheduled_date}{" "}
                      {job.scheduled_window ? `· ${job.scheduled_window}` : ""}
                    </div>
                  )}
                  <div className="job-actions">
                    <button
                      className="btn-accept"
                      type="button"
                      onClick={() => handleAccept(job)}
                      disabled={!user || isAccepting || isAccepted}
                      style={
                        isAccepted
                          ? { background: "#00aa55", cursor: "default", transform: "none" }
                          : undefined
                      }
                    >
                      {isAccepted ? "✓ Accepted!" : isAccepting ? "Accepting..." : "Accept Job"}
                    </button>
                    <button className="btn-details" type="button">
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            id="rider-history"
            style={{
              marginTop: 48,
              padding: "28px 24px",
              border: "3px solid var(--black)",
              background: "white",
              boxShadow: "6px 6px 0 0 var(--black)",
              scrollMarginTop: 100,
            }}
          >
            <div className="config-title" style={{ marginBottom: 12 }}>
              Job history
            </div>
            <p style={{ margin: 0, lineHeight: 1.6, opacity: 0.8, fontFamily: "Inter" }}>
              Delivered jobs are listed here after you mark them delivered.
            </p>
            {!!historyJobs.length && (
              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {historyJobs.map((job) => (
                  <div
                    key={`history-${job.id}`}
                    style={{
                      border: "2px solid var(--black)",
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      fontFamily: "Space Grotesk",
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    <span>{job.service_type ?? "Laundry"} · {job.pickup_city ?? "Colombo"}</span>
                    <span>{formatLKR(job.total_lkr ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            id="rider-settings"
            style={{
              marginTop: 24,
              padding: "28px 24px",
              border: "3px solid var(--black)",
              background: "#f5f5f5",
              scrollMarginTop: 100,
            }}
          >
            <div className="config-title" style={{ marginBottom: 12 }}>
              Settings
            </div>
            <ProfileSettings />
          </div>
        </main>
      </div>
    </div>
  );
}
