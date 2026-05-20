"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LaundraRouteLoader from "@/components/LaundraRouteLoader";
import ProfileSettings from "@/components/auth/ProfileSettings";
import { isAuthBypassEnabled } from "@/lib/auth-bypass";
import { useSupabaseUser } from "@/lib/supabase/session";

type BookingRow = {
  id: string;
  rider_id: string | null;
  package_id: string;
  service_type: string;
  pickup_address: string;
  pickup_city: string;
  scheduled_date: string;
  scheduled_window: string;
  status: string;
  total_lkr: number;
  created_at: string;
  addons: {
    checkout?: {
      payment_method?: string;
      invoice_number?: string;
    };
  } | null;
};

type RiderReviewRow = {
  booking_id: string;
  rating: number;
};

const ORDER_PROGRESS = [
  { status: "booking_placed", label: "Booked" },
  { status: "rider_assigned", label: "Rider assigned" },
  { status: "picked_up", label: "Picked" },
  { status: "out_for_delivery", label: "Ready to deliver" },
  { status: "delivered", label: "Delivered" },
] as const;

function formatLKR(amount: number) {
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

function paymentLabel(method?: string) {
  return method === "card" ? "Card payment" : "Cash on delivery";
}

function invoiceNumberFor(row: BookingRow) {
  return row.addons?.checkout?.invoice_number ?? `LND-${row.id.slice(0, 8).toUpperCase()}`;
}

function invoiceHtml(row: BookingRow) {
  const invoice = invoiceNumberFor(row);
  const method = paymentLabel(row.addons?.checkout?.payment_method);
  return `<!doctype html>
<html>
  <head>
    <title>${invoice}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      .invoice { border: 4px solid #111; padding: 28px; max-width: 720px; }
      h1 { margin: 0 0 10px; font-size: 34px; letter-spacing: 1px; }
      .muted { color: #555; margin-bottom: 28px; }
      .row { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 12px 0; gap: 16px; }
      .total { font-size: 24px; font-weight: 900; border-bottom: 0; margin-top: 12px; }
      .badge { display: inline-block; padding: 8px 10px; border: 2px solid #111; background: #ffcc00; font-weight: 800; }
    </style>
  </head>
  <body>
    <div class="invoice">
      <h1>LAUNDRA INVOICE</h1>
      <div class="muted">${invoice} · ${row.scheduled_date}</div>
      <div class="badge">${method}</div>
      <div class="row"><span>Service</span><strong>${row.package_id} · ${row.service_type.replaceAll("_", " ")}</strong></div>
      <div class="row"><span>Pickup</span><strong>${row.pickup_address}, ${row.pickup_city}</strong></div>
      <div class="row"><span>Window</span><strong>${row.scheduled_window}</strong></div>
      <div class="row total"><span>Total paid</span><span>${formatLKR(row.total_lkr)}</span></div>
    </div>
  </body>
</html>`;
}

function progressIndex(status: string) {
  if (status === "rider_arriving") return 1;
  if (status === "washing_started" || status === "washing_completed" || status === "ironing_started" || status === "ironing_completed") return 2;
  const index = ORDER_PROGRESS.findIndex((step) => step.status === status);
  return index >= 0 ? index : 0;
}

function CustomerProgressBar({ status }: { status: string }) {
  const current = progressIndex(status);
  const pct = (current / (ORDER_PROGRESS.length - 1)) * 100;

  return (
    <div style={{ marginTop: 14, maxWidth: 620 }}>
      <div
        style={{
          position: "relative",
          height: 14,
          border: "3px solid var(--black)",
          background: "white",
          boxShadow: "3px 3px 0 0 var(--black)",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: current >= ORDER_PROGRESS.length - 1 ? "var(--yellow)" : "var(--primary)",
            transition: "width 0.35s ease",
          }}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${ORDER_PROGRESS.length}, minmax(0, 1fr))`,
          gap: 8,
        }}
      >
        {ORDER_PROGRESS.map((step, idx) => {
          const done = idx <= current;
          return (
            <div key={step.status} style={{ minWidth: 0 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  border: "3px solid var(--black)",
                  background: done ? "var(--yellow)" : "white",
                  boxShadow: done ? "2px 2px 0 0 var(--black)" : "none",
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  fontFamily: "Space Grotesk",
                  fontSize: 9,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  lineHeight: 1.25,
                  opacity: done ? 1 : 0.52,
                }}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CustomerClient() {
  const { supabase, user, profile, loading: authLoading } = useSupabaseUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const newlyCreated = searchParams.get("new");
  const prevStatusRef = useRef<Record<string, string>>({});
  const [acceptBanner, setAcceptBanner] = useState<string | null>(null);
  const [reviewByBooking, setReviewByBooking] = useState<Record<string, number>>({});
  const [ratingDraft, setRatingDraft] = useState<Record<string, number>>({});
  const [ratingMessage, setRatingMessage] = useState<Record<string, string>>({});
  const [celebratingBooking, setCelebratingBooking] = useState<string | null>(null);

  const fetchBookings = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user || !supabase) return;
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      const { data, error: qErr } = await supabase
        .from("bookings")
        .select(
          "id,rider_id,package_id,service_type,pickup_address,pickup_city,scheduled_date,scheduled_window,status,total_lkr,created_at,addons",
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (qErr) {
        setError(qErr.message);
        if (!opts?.silent) setLoading(false);
        return;
      }
      setRows((data ?? []) as BookingRow[]);
      if (!opts?.silent) setLoading(false);
    },
    [supabase, user],
  );

  useEffect(() => {
    if (authLoading || isAuthBypassEnabled()) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile?.role === "rider") {
      router.replace("/rider");
    }
  }, [authLoading, user, profile?.role, router]);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthBypassEnabled() && !user) {
      const timer = window.setTimeout(() => {
        setLoading(false);
        setRows([]);
        setError(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (!user || !supabase) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }

    const fetchTimer = window.setTimeout(() => {
      fetchBookings();
    }, 0);

    const channel = supabase
      .channel("customer-bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `customer_id=eq.${user.id}` },
        () => fetchBookings({ silent: true }),
      )
      .subscribe();

    return () => {
      window.clearTimeout(fetchTimer);
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, supabase, fetchBookings]);

  useEffect(() => {
    if (!newlyCreated || !user || !supabase) return;

    let cancelled = false;
    const run = async () => {
      for (let i = 0; i < 12; i++) {
        if (cancelled) return;
        await fetchBookings({ silent: true });
        await new Promise((r) => setTimeout(r, 350));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [newlyCreated, user?.id, supabase, fetchBookings]);

  useEffect(() => {
    const waiting = rows.some((r) => r.status === "booking_placed");
    if (!waiting || !user || !supabase) return;

    const iv = window.setInterval(() => {
      fetchBookings({ silent: true });
    }, 4500);

    return () => window.clearInterval(iv);
  }, [rows, user?.id, supabase, fetchBookings]);

  useEffect(() => {
    for (const b of rows) {
      const prev = prevStatusRef.current[b.id];
      prevStatusRef.current[b.id] = b.status;
      if (
        prev === "booking_placed" &&
        (b.status === "rider_assigned" || b.status === "rider_arriving")
      ) {
        setAcceptBanner("Rider accepted — your pickup is confirmed.");
        window.setTimeout(() => setAcceptBanner(null), 8000);
        break;
      }
    }
  }, [rows]);

  useEffect(() => {
    if (authLoading || typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;

    const timer = window.setTimeout(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [authLoading, loading, rows.length]);

  useEffect(() => {
    if (!supabase || !user || !rows.length) return;
    const deliveredIds = rows.filter((r) => r.status === "delivered").map((r) => r.id);
    if (!deliveredIds.length) {
      const timer = window.setTimeout(() => setReviewByBooking({}), 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    supabase
      .from("rider_reviews")
      .select("booking_id,rating")
      .in("booking_id", deliveredIds)
      .eq("customer_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        ((data ?? []) as RiderReviewRow[]).forEach((review) => {
          next[review.booking_id] = review.rating;
        });
        setReviewByBooking(next);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, user, rows]);

  const submitRiderRating = async (row: BookingRow) => {
    if (!supabase || !user || !row.rider_id) return;
    const rating = ratingDraft[row.id] ?? 5;

    const { error: ratingError } = await supabase.from("rider_reviews").insert({
      booking_id: row.id,
      customer_id: user.id,
      rider_id: row.rider_id,
      rating,
      comment: `Customer rated ${rating}/5 after delivery.`,
    });

    if (ratingError) {
      setRatingMessage((prev) => ({
        ...prev,
        [row.id]: ratingError.code === "23505" ? "You already rated this delivery." : ratingError.message,
      }));
      return;
    }

    setReviewByBooking((prev) => ({ ...prev, [row.id]: rating }));
    setCelebratingBooking(row.id);
    setRatingMessage((prev) => ({ ...prev, [row.id]: "Rating sent. Thanks for celebrating great service." }));
    window.setTimeout(() => setCelebratingBooking(null), 2400);
  };

  const printInvoice = (row: BookingRow) => {
    const popup = window.open("", "_blank", "width=820,height=900");
    if (!popup) return;
    popup.document.write(invoiceHtml(row));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const downloadInvoice = (row: BookingRow) => {
    const blob = new Blob([invoiceHtml(row)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoiceNumberFor(row)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bypass = isAuthBypassEnabled();

  const highlightBooking = useMemo(() => {
    if (!newlyCreated) return null;
    return rows.find((r) => r.id === newlyCreated) ?? null;
  }, [rows, newlyCreated]);

  const dismissNewQuery = () => {
    router.replace("/customer");
  };

  if (authLoading && !bypass) {
    return (
      <div id="page-customer-loading" className="page-section active">
        <LaundraRouteLoader title="Your orders" subtitle="Syncing your dashboard…" />
      </div>
    );
  }

  if (!user && !bypass) {
    return (
      <div className="section-pad" style={{ paddingTop: 120, background: "var(--bg)" }}>
        <div className="section-inner">
          <div className="section-label">Customer</div>
          <h2 className="section-title">Dashboard</h2>
          <div className="config-card" style={{ maxWidth: 720 }}>
            <div className="config-title">Sign in required</div>
            <Link className="btn-yellow" href="/login">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user && bypass) {
    return (
      <div className="section-pad" style={{ paddingTop: 120, background: "var(--bg)" }}>
        <div className="section-inner">
          <div className="section-label animate-in">Customer</div>
          <h2 className="section-title animate-in">
            Your
            <br />
            Orders.
          </h2>
          <div
            className="config-card animate-in"
            style={{
              marginBottom: 18,
              borderColor: "var(--black)",
              background: "var(--yellow)",
            }}
          >
            <div className="config-title">Preview mode</div>
            <p style={{ lineHeight: 1.6, opacity: 0.85 }}>
              Sign-in gate is off. Orders stay empty until you sign in with Supabase.
            </p>
            <Link className="btn-yellow" href="/login" style={{ marginTop: 12 }}>
              Sign in
            </Link>
          </div>
          <div className="config-card animate-in">
            <div className="config-title">Active & History</div>
            <div style={{ opacity: 0.7 }}>No data loaded.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-pad" style={{ paddingTop: 120, background: "var(--bg)" }}>
      <div className="section-inner">
        <div className="section-label animate-in">Customer</div>
        <h2 className="section-title animate-in">
          Your
          <br />
          Orders.
        </h2>

        {acceptBanner && (
          <div
            className="animate-in"
            style={{
              marginBottom: 18,
              border: "4px solid var(--black)",
              background: "var(--yellow)",
              boxShadow: "8px 8px 0 0 var(--black)",
              padding: "16px 18px",
              fontFamily: "Space Grotesk",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontSize: 13,
            }}
          >
            {acceptBanner}
          </div>
        )}

        {newlyCreated && (
          <div
            style={{
              marginBottom: 22,
              border: "4px solid var(--black)",
              background: highlightBooking?.status === "booking_placed" ? "#d6e3ff" : "white",
              boxShadow: "10px 10px 0 0 var(--primary)",
              padding: "22px 22px 20px",
              scrollMarginTop: 120,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "Space Grotesk",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--primary)",
                    marginBottom: 8,
                  }}
                >
                  Latest booking
                </div>
                {!highlightBooking && (
                  <>
                    <div
                      style={{
                        fontFamily: "Space Grotesk",
                        fontWeight: 900,
                        fontSize: 22,
                        textTransform: "uppercase",
                        letterSpacing: "-0.02em",
                        marginBottom: 10,
                      }}
                    >
                      Syncing your order…
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        border: "3px solid var(--black)",
                        background: "var(--yellow)",
                        fontFamily: "Space Grotesk",
                        fontWeight: 800,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Connecting to dashboard
                      <span className="loading-dots yellow" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  </>
                )}
                {highlightBooking && highlightBooking.status === "booking_placed" && (
                  <>
                    <div
                      style={{
                        fontFamily: "Space Grotesk",
                        fontWeight: 900,
                        fontSize: 26,
                        textTransform: "uppercase",
                        letterSpacing: "-0.02em",
                        marginBottom: 12,
                        lineHeight: 1.15,
                      }}
                    >
                      Searching for riders
                    </div>
                    <p style={{ fontFamily: "Inter", lineHeight: 1.55, marginBottom: 14, opacity: 0.9 }}>
                      Hang tight — we&apos;re matching a verified rider near{" "}
                      <strong>{highlightBooking.pickup_city}</strong>. You&apos;ll see updates here the moment someone
                      accepts.
                    </p>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        border: "3px solid var(--black)",
                        background: "white",
                        boxShadow: "4px 4px 0 0 var(--black)",
                        fontFamily: "Space Grotesk",
                        fontWeight: 800,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Matching riders
                      <span className="loading-dots blue" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  </>
                )}
                {highlightBooking &&
                  (highlightBooking.status === "rider_assigned" ||
                    highlightBooking.status === "rider_arriving") && (
                    <>
                      <div
                        style={{
                          fontFamily: "Space Grotesk",
                          fontWeight: 900,
                          fontSize: 26,
                          textTransform: "uppercase",
                          letterSpacing: "-0.02em",
                          marginBottom: 10,
                          color: "var(--black)",
                        }}
                      >
                        Rider accepted
                      </div>
                      <p style={{ fontFamily: "Inter", lineHeight: 1.55, marginBottom: 0, opacity: 0.9 }}>
                        Your pickup is locked in. Track live progress or book another load anytime.
                      </p>
                    </>
                  )}
                {highlightBooking &&
                  highlightBooking.status !== "booking_placed" &&
                  highlightBooking.status !== "cancelled" &&
                  highlightBooking.status !== "rider_assigned" &&
                  highlightBooking.status !== "rider_arriving" && (
                    <>
                      <div
                        style={{
                          fontFamily: "Space Grotesk",
                          fontWeight: 900,
                          fontSize: 24,
                          textTransform: "uppercase",
                          letterSpacing: "-0.02em",
                          marginBottom: 10,
                        }}
                      >
                        Order in progress
                      </div>
                      <p style={{ fontFamily: "Inter", lineHeight: 1.55, marginBottom: 0, opacity: 0.9 }}>
                        Follow every step from pickup to delivery — track below or open live map.
                      </p>
                    </>
                  )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
                <Link className="btn-outline" href="/" style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                  Home
                </Link>
                <Link className="btn-yellow" href="/booking?package=basic" style={{ textAlign: "center" }}>
                  New booking
                </Link>
                <button
                  type="button"
                  className="btn-black"
                  style={{ fontSize: 12, padding: "10px 16px" }}
                  onClick={dismissNewQuery}
                >
                  Dismiss banner
                </button>
              </div>
            </div>
            {highlightBooking && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: "3px solid var(--black)",
                  fontFamily: "Space Grotesk",
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  opacity: 0.85,
                }}
              >
                {highlightBooking.package_id} · {highlightBooking.service_type.replaceAll("_", " ")} ·{" "}
                {formatLKR(highlightBooking.total_lkr)} · {highlightBooking.scheduled_date}
              </div>
            )}
          </div>
        )}

        <div className="config-card animate-in" id="customer-orders" style={{ scrollMarginTop: 120 }}>
          <div className="config-title">Active & History</div>

          {loading && (
            <div style={{ fontFamily: "Space Grotesk", fontWeight: 800, textTransform: "uppercase", opacity: 0.7 }}>
              Loading…
            </div>
          )}

          {error && (
            <div
              style={{
                color: "var(--red)",
                fontWeight: 800,
                fontFamily: "Space Grotesk",
                textTransform: "uppercase",
              }}
            >
              {error}
            </div>
          )}

          {!loading && !rows.length && (
            <div style={{ opacity: 0.75, lineHeight: 1.6 }}>
              No bookings yet. Create your first pickup booking.
              <div style={{ marginTop: 14 }}>
                <Link className="btn-primary" href="/booking">
                  Book Pickup
                </Link>
              </div>
            </div>
          )}

          {!!rows.length && (
            <div style={{ display: "grid", gap: 14 }}>
              {rows.map((b) => {
                const isWaiting = b.status === "booking_placed";
                const riderLockedIn =
                  b.status === "rider_assigned" || b.status === "rider_arriving";
                return (
                  <div
                    key={b.id}
                    style={{
                      border: "3px solid var(--black)",
                      boxShadow: "4px 4px 0 0 var(--black)",
                      background: newlyCreated === b.id ? "#fffef5" : "white",
                      padding: 16,
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 16,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "Space Grotesk",
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          marginBottom: 6,
                        }}
                      >
                        {b.package_id} · {b.service_type.replaceAll("_", " ")}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {b.pickup_address}, {b.pickup_city}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.75,
                          marginTop: 4,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {b.scheduled_date} · {b.scheduled_window} · {b.status.replaceAll("_", " ")}
                      </div>
                      <CustomerProgressBar status={b.status} />
                      {isWaiting && (
                        <div
                          style={{
                            marginTop: 10,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 10px",
                            border: "2px solid var(--black)",
                            fontFamily: "Space Grotesk",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            fontSize: 10,
                            letterSpacing: "0.08em",
                            background: "#d6e3ff",
                          }}
                        >
                          Searching riders
                          <span className="loading-dots blue" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </span>
                        </div>
                      )}
                      {riderLockedIn && (
                        <div
                          style={{
                            marginTop: 10,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            border: "2px solid var(--black)",
                            fontFamily: "Space Grotesk",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            fontSize: 10,
                            letterSpacing: "0.08em",
                            background: "var(--yellow)",
                          }}
                        >
                          Rider accepted
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontFamily: "Space Grotesk",
                          fontWeight: 900,
                          fontSize: 22,
                          color: "var(--primary)",
                        }}
                      >
                        {formatLKR(b.total_lkr)}
                      </div>
                      <Link className="btn-outline" href={`/track/${b.id}`} style={{ marginTop: 8, display: "inline-block" }}>
                        Track
                      </Link>
                    </div>

                    {b.status === "delivered" && (
                      <div
                        className={celebratingBooking === b.id ? "rating-celebration burst" : "rating-celebration"}
                        style={{
                          gridColumn: "1 / -1",
                          marginTop: 4,
                          border: "4px solid var(--black)",
                          background: "#fffef5",
                          boxShadow: "8px 8px 0 0 var(--yellow)",
                          padding: 16,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 16,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontFamily: "Space Grotesk",
                                fontWeight: 900,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                fontSize: 12,
                              }}
                            >
                              Delivery complete
                            </div>
                            <div style={{ marginTop: 6, fontFamily: "Inter", fontSize: 13, opacity: 0.78 }}>
                              Invoice {invoiceNumberFor(b)} · {paymentLabel(b.addons?.checkout?.payment_method)}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button className="btn-outline" type="button" onClick={() => printInvoice(b)}>
                              Print invoice
                            </button>
                            <button className="btn-yellow" type="button" onClick={() => downloadInvoice(b)}>
                              Download invoice
                            </button>
                          </div>
                        </div>

                        <div style={{ marginTop: 18, borderTop: "3px solid var(--black)", paddingTop: 14 }}>
                          {reviewByBooking[b.id] ? (
                            <div
                              style={{
                                fontFamily: "Space Grotesk",
                                fontWeight: 900,
                                textTransform: "uppercase",
                                color: "var(--primary)",
                              }}
                            >
                              You rated this rider {reviewByBooking[b.id]}/5 stars
                            </div>
                          ) : (
                            <>
                              <div
                                style={{
                                  fontFamily: "Space Grotesk",
                                  fontWeight: 900,
                                  textTransform: "uppercase",
                                  marginBottom: 10,
                                }}
                              >
                                Celebrate your rider
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                {[1, 2, 3, 4, 5].map((n) => {
                                  const active = n <= (ratingDraft[b.id] ?? 5);
                                  return (
                                    <button
                                      key={n}
                                      className={active ? "star-pop active" : "star-pop"}
                                      type="button"
                                      onClick={() => setRatingDraft((prev) => ({ ...prev, [b.id]: n }))}
                                      aria-label={`${n} stars`}
                                    >
                                      <span className="material-symbols-outlined">star</span>
                                    </button>
                                  );
                                })}
                                <button
                                  className="btn-black"
                                  type="button"
                                  onClick={() => void submitRiderRating(b)}
                                  disabled={!b.rider_id}
                                  style={{ marginLeft: 4 }}
                                >
                                  Send rating
                                </button>
                              </div>
                            </>
                          )}
                          {ratingMessage[b.id] && (
                            <div style={{ marginTop: 10, fontFamily: "Inter", fontSize: 13, fontWeight: 800 }}>
                              {ratingMessage[b.id]}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="config-card animate-in"
          id="customer-history"
          style={{ marginTop: 24, scrollMarginTop: 120 }}
        >
          <div className="config-title">History</div>
          {!rows.length && <div style={{ opacity: 0.75 }}>Completed and past orders will appear here.</div>}
          {!!rows.length && (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.slice(0, 5).map((b) => (
                <div
                  key={`history-${b.id}`}
                  style={{
                    border: "2px solid var(--black)",
                    padding: "10px 12px",
                    fontFamily: "Space Grotesk",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>{b.package_id} · {b.status.replaceAll("_", " ")}</span>
                  <span>{b.scheduled_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="config-card animate-in"
          id="customer-settings"
          style={{ marginTop: 24, scrollMarginTop: 120 }}
        >
          <div className="config-title">Account</div>
          <ProfileSettings />
        </div>
      </div>
    </div>
  );
}
