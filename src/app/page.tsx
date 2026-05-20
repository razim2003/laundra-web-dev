"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { loginUrlForBooking } from "@/lib/marketing-links";
import { useSupabaseUser } from "@/lib/supabase/session";

type BusinessReview = {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
};

function formatLKR(amount: number) {
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

export default function Home() {
  const { supabase, user, profile } = useSupabaseUser();
  const [tab, setTab] = useState<"customer" | "rider">("customer");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const [businessReviews, setBusinessReviews] = useState<BusinessReview[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [slidePos, setSlidePos] = useState(0);
  const [visibleSlides, setVisibleSlides] = useState(3);
  const isRider = profile?.role === "rider";
  const showBooking = !isRider;
  const showRiderCta = !user;

  const testimonials = useMemo(
    () => [
      {
        stars: 5,
        quote:
          '"I booked a pickup in under a minute. Clothes came back folded like a boutique — crisp, clean, and delivered right to my apartment in Colombo."',
        name: "Ayesha",
        role: "Colombo 03",
      },
      {
        stars: 5,
        quote:
          '"The express service is unreal. Pickup, wash, iron, deliver — same day. Feels like a premium product, not a basic laundry shop."',
        name: "Nimal",
        role: "Rajagiriya",
      },
      {
        stars: 5,
        quote:
          '"As a rider, it’s simple: see jobs near me, accept, follow the workflow, and get weekly payouts. Made an extra Rs. 145,000 this month."',
        name: "Kasun",
        role: "Rider · Dehiwala",
      },
      {
        stars: 5,
        quote:
          '"The tracking is addictive. I can see exactly when my pickup is assigned and when it’s on the way back. Zero uncertainty."',
        name: "Shehani",
        role: "Colombo 02",
      },
      {
        stars: 5,
        quote:
          '"They handle delicates properly. My dry-clean items came back immaculate, and the packaging feels like luxury retail."',
        name: "Ruwan",
        role: "Nugegoda",
      },
    ],
    [],
  );

  const visibleReviews = useMemo(
    () => [
      ...businessReviews.map((r) => ({
        stars: r.rating,
        quote: `"${r.comment}"`,
        name: r.customer_name,
        role: "Customer review",
      })),
      ...testimonials,
    ],
    [businessReviews, testimonials],
  );

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    supabase
      .from("business_reviews")
      .select("id,customer_name,rating,comment")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[laundra] business reviews unavailable:", error.message);
          return;
        }
        setBusinessReviews((data ?? []) as BusinessReview[]);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    const getVisibleSlides = () =>
      window.innerWidth <= 900 ? 1 : window.innerWidth <= 1200 ? 2 : 3;
    const onResize = () => setVisibleSlides(getVisibleSlides());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const slideTestimonials = (dir: number) => {
    const maxPos = Math.max(0, visibleReviews.length - visibleSlides);
    setSlidePos((p) => Math.max(0, Math.min(p + dir, maxPos)));
  };

  const submitReview = async () => {
    setReviewStatus(null);
    if (!user || !profile) {
      setReviewStatus("Please sign in as a customer to leave a review.");
      return;
    }
    if (profile.role !== "customer") {
      setReviewStatus("Only customer accounts can leave business reviews.");
      return;
    }
    if (!supabase) {
      setReviewStatus("Reviews are not available right now.");
      return;
    }
    if (reviewText.trim().length < 8) {
      setReviewStatus("Write a short review before submitting.");
      return;
    }

    const customerName = profile.full_name?.trim() || "Laundra customer";
    const { data, error } = await supabase
      .from("business_reviews")
      .insert({
        customer_id: user.id,
        customer_name: customerName,
        rating,
        comment: reviewText.trim(),
      })
      .select("id,customer_name,rating,comment")
      .single();

    if (error) {
      setReviewStatus("Review storage is not ready. Apply the latest Supabase patch and try again.");
      return;
    }

    setBusinessReviews((prev) => [data as BusinessReview, ...prev]);
    setReviewText("");
    setRating(5);
    setReviewStatus("Thanks. Your review is now listed.");
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLElement>(".testimonial-card");
    if (!cards.length) return;
    const cardWidth = cards[0].offsetWidth + 24;
    track.style.transform = `translateX(-${slidePos * cardWidth}px)`;
  }, [slidePos, visibleReviews.length]);

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div id="page-home" className="page-section active" suppressHydrationWarning>
      {/* HERO */}
      <section
        className="section-pad"
        style={{ paddingTop: 0, paddingBottom: 0, background: "var(--bg)" }}
      >
        <div className="hero">
          <div className="hero-content animate-in visible">
            <div className="hero-eyebrow">Premium Laundry · Pickup & Delivery</div>
            <h1 className="hero-title">
              CLEAN.<br />
              <span className="accent">BOLD.</span>
              <br />
              PRECISE.
            </h1>
            <p className="hero-sub">
              Professional garment care for the modern urbanite. We pick up, wash, iron, and
              deliver — with precision you can count on.
            </p>
            <div className="hero-actions">
              {showBooking && (
                <Link className="btn-yellow" href={loginUrlForBooking("basic")} prefetch={false}>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      verticalAlign: "middle",
                      marginRight: 8,
                      fontSize: "20px",
                    }}
                  >
                    local_laundry_service
                  </span>
                  Book Pickup
                </Link>
              )}
              {showRiderCta && (
                <Link className="btn-black" href="/signup?role=rider">
                  <span
                    className="material-symbols-outlined"
                    style={{
                      verticalAlign: "middle",
                      marginRight: 8,
                      fontSize: "20px",
                    }}
                  >
                    two_wheeler
                  </span>
                  Become a Rider
                </Link>
              )}
            </div>

            <div className="hero-stats animate-in visible">
              <div className="hero-stat">
                <div className="hero-stat-num" id="stat1">
                  0
                </div>
                <div className="hero-stat-label">Happy Customers</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-num" id="stat2">
                  0
                </div>
                <div className="hero-stat-label">Orders Completed</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-num" id="stat3">
                  0
                </div>
                <div className="hero-stat-label">Active Riders</div>
              </div>
            </div>

            <div className="trust-badges">
              <div className="trust-badge">
                <span className="material-symbols-outlined">verified</span>Trusted Brand
              </div>
              <div className="trust-badge">
                <span className="material-symbols-outlined">schedule</span>Same-Day Service
              </div>
              <div className="trust-badge">
                <span className="material-symbols-outlined">eco</span>Eco-Friendly
              </div>
              <div className="trust-badge">
                <span className="material-symbols-outlined">lock</span>Secure Payments
              </div>
            </div>
          </div>

          <div className="hero-visual animate-in visible" style={{ animationDelay: "0.2s" }}>
            <div className="float-badge top-right">✦ Express 6h</div>
            <div className="machine-container">
              {/* Original SVG preserved */}
              <svg
                className="machine-svg"
                viewBox="0 0 500 500"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="500" height="500" fill="#1a1a1a" />
                <defs>
                  <clipPath id="laundraDrumClip">
                    <circle cx="250" cy="290" r="93" />
                  </clipPath>
                </defs>
                <g stroke="#2a2a2a" strokeWidth="1" opacity="0.5">
                  <line x1="0" y1="50" x2="500" y2="50" />
                  <line x1="0" y1="100" x2="500" y2="100" />
                  <line x1="0" y1="150" x2="500" y2="150" />
                  <line x1="0" y1="200" x2="500" y2="200" />
                  <line x1="0" y1="250" x2="500" y2="250" />
                  <line x1="0" y1="300" x2="500" y2="300" />
                  <line x1="0" y1="350" x2="500" y2="350" />
                  <line x1="0" y1="400" x2="500" y2="400" />
                  <line x1="0" y1="450" x2="500" y2="450" />
                  <line x1="50" y1="0" x2="50" y2="500" />
                  <line x1="100" y1="0" x2="100" y2="500" />
                  <line x1="150" y1="0" x2="150" y2="500" />
                  <line x1="200" y1="0" x2="200" y2="500" />
                  <line x1="250" y1="0" x2="250" y2="500" />
                  <line x1="300" y1="0" x2="300" y2="500" />
                  <line x1="350" y1="0" x2="350" y2="500" />
                  <line x1="400" y1="0" x2="400" y2="500" />
                  <line x1="450" y1="0" x2="450" y2="500" />
                </g>
                <rect
                  x="80"
                  y="100"
                  width="340"
                  height="320"
                  rx="0"
                  fill="#f5f0e8"
                  stroke="#005ab4"
                  strokeWidth="4"
                />
                <rect x="80" y="100" width="340" height="70" fill="#005ab4" />
                <circle cx="140" cy="135" r="18" fill="#ffcc00" stroke="#1a1a1a" strokeWidth="3" />
                <line x1="140" y1="120" x2="140" y2="135" stroke="#1a1a1a" strokeWidth="3" />
                <circle cx="200" cy="135" r="18" fill="white" stroke="#1a1a1a" strokeWidth="3" />
                <line x1="200" y1="120" x2="207" y2="130" stroke="#1a1a1a" strokeWidth="3" />
                <rect x="240" y="115" width="120" height="40" rx="2" fill="#0a0a0a" stroke="#ffcc00" strokeWidth="2" />
                <text
                  x="300"
                  y="139"
                  textAnchor="middle"
                  fill="#ffcc00"
                  fontFamily="Space Grotesk"
                  fontSize="14"
                  fontWeight="900"
                >
                  WASH 40°
                </text>
                <circle cx="250" cy="290" r="110" fill="white" stroke="#005ab4" strokeWidth="6" />
                <circle cx="250" cy="290" r="95" fill="#d6e3ff" stroke="#005ab4" strokeWidth="3" />
                <g clipPath="url(#laundraDrumClip)">
                  <circle cx="250" cy="290" r="92" fill="#7ea8ff" opacity="0.22" />
                  <g>
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 250 290"
                      to="360 250 290"
                      dur="2.9s"
                      repeatCount="indefinite"
                    />
                    <path
                      d="M 228 252 L 262 252 L 268 288 L 248 312 L 228 288 Z"
                      fill="#ffcc00"
                      stroke="#1a1a1a"
                      strokeWidth="2.5"
                      opacity="0.95"
                    />
                    <rect x="236" y="238" width="24" height="10" rx="3" fill="#ffcc00" stroke="#1a1a1a" strokeWidth="2" />
                    <ellipse
                      cx="276"
                      cy="278"
                      rx="22"
                      ry="17"
                      fill="#ffffff"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      opacity="0.9"
                      transform="rotate(38 276 278)"
                    />
                    <rect
                      x="216"
                      y="266"
                      width="32"
                      height="40"
                      rx="6"
                      fill="#e63b2e"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      opacity="0.88"
                      transform="rotate(-22 232 286)"
                    />
                  </g>
                  <g>
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="140 250 290"
                      to="-220 250 290"
                      dur="2.2s"
                      repeatCount="indefinite"
                    />
                    <rect
                      x="238"
                      y="246"
                      width="28"
                      height="36"
                      rx="5"
                      fill="#f5f0e8"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      transform="rotate(14 252 264)"
                    />
                    <path
                      d="M 258 274 Q 274 262 286 276 Q 278 294 262 300 Z"
                      fill="#005ab4"
                      opacity="0.5"
                    />
                  </g>
                  <circle cx="228" cy="312" r="4" fill="white" opacity="0.55">
                    <animate attributeName="cy" values="312;268;312" dur="2.3s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="268" cy="320" r="3.5" fill="white" opacity="0.45">
                    <animate attributeName="cy" values="320;278;320" dur="1.85s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="288" cy="306" r="3" fill="white" opacity="0.4">
                    <animate attributeName="cy" values="306;262;306" dur="2.55s" repeatCount="indefinite" />
                  </circle>
                </g>
                <circle cx="250" cy="290" r="88" fill="#1a1a1a" stroke="#005ab4" strokeWidth="2" opacity="0.1">
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0 250 290;360 250 290"
                    dur="4s"
                    repeatCount="indefinite"
                  />
                </circle>
                <g transform="translate(250,290)">
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 0 0"
                    to="360 0 0"
                    dur="4s"
                    repeatCount="indefinite"
                  />
                  <line x1="0" y1="-80" x2="0" y2="80" stroke="#2a5" strokeWidth="8" strokeLinecap="round" opacity="0.6" />
                  <line x1="-80" y1="0" x2="80" y2="0" stroke="#2a5" strokeWidth="8" strokeLinecap="round" opacity="0.6" />
                  <line x1="-57" y1="-57" x2="57" y2="57" stroke="#2a5" strokeWidth="6" strokeLinecap="round" opacity="0.4" />
                  <line x1="57" y1="-57" x2="-57" y2="57" stroke="#2a5" strokeWidth="6" strokeLinecap="round" opacity="0.4" />
                  <rect x="-20" y="-30" width="40" height="25" rx="3" fill="#ffcc00" opacity="0.7" transform="rotate(30)" />
                  <rect x="10" y="15" width="35" height="20" rx="3" fill="white" opacity="0.6" transform="rotate(-20)" />
                  <rect x="-35" y="5" width="30" height="18" rx="3" fill="#e63b2e" opacity="0.6" transform="rotate(10)" />
                </g>
                <rect x="308" y="282" width="30" height="16" rx="8" fill="#ffcc00" stroke="#1a1a1a" strokeWidth="3" />
                <circle cx="150" cy="360" r="8" fill="#005ab4" opacity="0.3">
                  <animate attributeName="cy" values="360;340;360" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="350" cy="370" r="6" fill="#005ab4" opacity="0.3">
                  <animate attributeName="cy" values="370;350;370" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="120" cy="395" r="10" fill="#ffcc00" opacity="0.3">
                  <animate attributeName="cy" values="395;370;395" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle cx="380" cy="380" r="7" fill="#ffcc00" opacity="0.2">
                  <animate attributeName="cy" values="380;355;380" dur="3.5s" repeatCount="indefinite" />
                </circle>
                <rect x="80" y="398" width="340" height="22" fill="#e0d8cc" stroke="#005ab4" strokeWidth="2" />
                <rect x="100" y="403" width="60" height="12" rx="0" fill="#005ab4" opacity="0.4" />
                <rect x="175" y="403" width="60" height="12" rx="0" fill="#005ab4" opacity="0.4" />
                <rect x="250" y="403" width="60" height="12" rx="0" fill="#005ab4" opacity="0.4" />
                <rect x="325" y="403" width="60" height="12" rx="0" fill="#005ab4" opacity="0.4" />
                <circle cx="395" cy="135" r="10" fill="#00ff88" opacity="0.9">
                  <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.5s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
            <div className="float-badge bottom-left">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "16px", verticalAlign: "middle" }}
              >
                local_shipping
              </span>{" "}
              Pickup in 2h
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="ticker-wrap">
        <div className="ticker-inner">
          <div className="ticker-item">
            <span className="ticker-dot" />
            Express Wash
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Professional Ironing
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Pickup & Delivery
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Eco-Friendly Detergents
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Real-Time Tracking
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Rider Assignment
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            24/7 Service
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Dry Cleaning
          </div>
          {/* Repeat for loop effect */}
          <div className="ticker-item">
            <span className="ticker-dot" />
            Express Wash
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Professional Ironing
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Pickup & Delivery
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Eco-Friendly Detergents
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Real-Time Tracking
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Rider Assignment
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            24/7 Service
          </div>
          <div className="ticker-item">
            <span className="ticker-dot" />
            Dry Cleaning
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="section-pad bg-alt" id="process">
        <div className="section-inner">
          <div className="section-label animate-in">How It Works</div>
          <h2 className="section-title animate-in">
            Three
            <br />
            Steps
            <br />
            To Clean.
          </h2>

          <div className="tab-group">
            <button
              className={`tab-btn ${tab === "customer" ? "active" : ""}`}
              type="button"
              onClick={() => setTab("customer")}
            >
              Customer Flow
            </button>
            <button
              className={`tab-btn ${tab === "rider" ? "active" : ""}`}
              type="button"
              onClick={() => setTab("rider")}
            >
              Rider Flow
            </button>
          </div>

          <div className={`tab-panel ${tab === "customer" ? "active" : ""}`} id="tab-customer">
            <div className="process-grid animate-in">
              <div className="process-step">
                <div className="process-num">01</div>
                <span className="material-symbols-outlined process-icon">event_available</span>
                <h3 className="process-step-title">Book Online</h3>
                <p className="process-step-desc">
                  Schedule your pickup in under 60 seconds. Choose service type, weight, and
                  preferred time window. Pay securely via card or digital wallet.
                </p>
              </div>
              <div className="process-step">
                <div className="process-num">02</div>
                <span className="material-symbols-outlined process-icon">local_shipping</span>
                <h3 className="process-step-title">We Collect</h3>
                <p className="process-step-desc">
                  A verified Laundra rider arrives at your door within your scheduled window. Hand
                  over your bag and track every step in real-time.
                </p>
              </div>
              <div className="process-step">
                <div className="process-num">03</div>
                <span className="material-symbols-outlined process-icon">checkroom</span>
                <h3 className="process-step-title">Delivered Fresh</h3>
                <p className="process-step-desc">
                  Washed, ironed, and folded to geometric perfection. Returned within 24 hours —
                  or 6 hours on express orders. Ready to wear immediately.
                </p>
              </div>
            </div>
          </div>

          <div className={`tab-panel ${tab === "rider" ? "active" : ""}`} id="tab-rider">
            <div className="process-grid animate-in">
              <div className="process-step">
                <div className="process-num">01</div>
                <span className="material-symbols-outlined process-icon">app_registration</span>
                <h3 className="process-step-title">Sign Up</h3>
                <p className="process-step-desc">
                  Register as a Laundra rider in minutes. Set up your profile with availability
                  windows and start accepting jobs today.
                </p>
              </div>
              <div className="process-step">
                <div className="process-num">02</div>
                <span className="material-symbols-outlined process-icon">list_alt</span>
                <h3 className="process-step-title">Accept Jobs</h3>
                <p className="process-step-desc">
                  Browse available pickup requests on your dashboard. Accept the jobs that fit
                  your route. See earnings upfront before committing to any pickup.
                </p>
              </div>
              <div className="process-step">
                <div className="process-num">03</div>
                <span className="material-symbols-outlined process-icon">payments</span>
                <h3 className="process-step-title">Get Paid</h3>
                <p className="process-step-desc">
                  Earn per delivery, plus tips. Weekly automated payouts to your bank account.
                  Track your earnings, ratings, and completed jobs live on your portal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES (trimmed but same aesthetic) */}
      <section className="section-pad" id="features" style={{ background: "var(--bg)" }}>
        <div className="section-inner">
          <div className="section-label animate-in">Our Services</div>
          <h2 className="section-title animate-in">
            Specialized
            <br />
            Care.
          </h2>

          <div className="bento-grid animate-in">
            <div className="bento-card span-2 blue-light" style={{ gridRow: "span 2" }}>
              <span
                className="material-symbols-outlined bento-card-icon"
                style={{ color: "var(--primary)" }}
              >
                local_laundry_service
              </span>
              <h3
                className="bento-card-title"
                style={{ fontSize: 48, lineHeight: 0.9, letterSpacing: "-0.02em" }}
              >
                WASH &<br />
                FOLD
              </h3>
              <p className="bento-card-desc" style={{ fontSize: 16, marginTop: 16, color: "#444" }}>
                Full laundry cycle with premium detergents. We sort by color and fabric type, wash
                at optimal temperatures, dry, and machine-fold with geometric precision.
              </p>
              <div
                style={{
                  marginTop: 32,
                  borderTop: "3px solid var(--black)",
                  paddingTop: 20,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: "var(--primary)",
                    color: "white",
                    fontFamily: "Space Grotesk",
                    fontWeight: 800,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "6px 12px",
                  }}
                >
                  Rs. 450/kg
                </span>
                <span
                  style={{
                    background: "var(--black)",
                    color: "var(--yellow)",
                    fontFamily: "Space Grotesk",
                    fontWeight: 800,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "6px 12px",
                  }}
                >
                  24h Turnaround
                </span>
              </div>
            </div>

            <div className="bento-card dark">
              <span className="material-symbols-outlined bento-card-icon" style={{ color: "var(--yellow)" }}>
                iron
              </span>
              <h3 className="bento-card-title">Ironing Only</h3>
              <p className="bento-card-desc">Steam-pressed perfection for shirts, suits, and delicates.</p>
            </div>

            <div className="bento-card blue">
              <span className="material-symbols-outlined bento-card-icon">bolt</span>
              <h3 className="bento-card-title">Express 6h</h3>
              <p className="bento-card-desc">Urgent turnaround for the modern professional. Speed meets accuracy.</p>
            </div>

            <div className="bento-card yellow">
              <span className="material-symbols-outlined bento-card-icon" style={{ color: "var(--black)" }}>
                dry_cleaning
              </span>
              <h3 className="bento-card-title">Dry Clean</h3>
              <p className="bento-card-desc">Couture-grade care for formalwear, silks, and premium fabrics.</p>
            </div>

            <div className="bento-card tan">
              <span className="material-symbols-outlined bento-card-icon" style={{ color: "var(--primary)" }}>
                verified
              </span>
              <h3 className="bento-card-title">Verified Riders</h3>
              <p className="bento-card-desc">Every pickup is handled by a verified rider with tracked handoff.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="section-pad bg-alt" id="pricing">
        <div className="section-inner">
          <div className="section-label animate-in">Pricing</div>
          <h2 className="section-title animate-in">
            Clear
            <br />
            Rates.
          </h2>

          <div className="pricing-grid animate-in">
            <div className="pricing-card">
              <div className="pricing-tier">Basic</div>
              <div className="pricing-price">
                Rs. 450<span style={{ fontSize: 28, opacity: 0.5 }}>/kg</span>
              </div>
              <div className="pricing-unit">Wash & Fold • Standard</div>
              <ul className="pricing-features">
                <li>
                  <span className="material-symbols-outlined">check</span>24-hour turnaround
                </li>
                <li>
                  <span className="material-symbols-outlined">check</span>Pickup + delivery (Colombo)
                </li>
                <li>
                  <span className="material-symbols-outlined">check</span>Premium detergents
                </li>
              </ul>
              {showBooking && (
                <Link className="btn-primary" href={loginUrlForBooking("basic")} prefetch={false}>
                  Book Basic
                </Link>
              )}
            </div>

            <div className="pricing-card featured">
              <div className="pricing-badge">Most Popular</div>
              <div className="pricing-tier" style={{ color: "rgba(255,255,255,0.6)" }}>
                Pro
              </div>
              <div className="pricing-price">
                Rs. 650<span style={{ fontSize: 28, opacity: 0.5 }}>/kg</span>
              </div>
              <div className="pricing-unit" style={{ color: "rgba(255,255,255,0.6)" }}>
                Wash + Iron • Express
              </div>
              <ul className="pricing-features">
                <li>
                  <span className="material-symbols-outlined">bolt</span>Express 6h option
                </li>
                <li>
                  <span className="material-symbols-outlined">check</span>Priority rider assignment
                </li>
                <li>
                  <span className="material-symbols-outlined">check</span>Hypoallergenic available
                </li>
              </ul>
              {showBooking && (
                <Link className="btn-yellow" href={loginUrlForBooking("pro")} style={{ fontSize: 14 }} prefetch={false}>
                  Book Pro
                </Link>
              )}
            </div>

            <div className="pricing-card">
              <div className="pricing-tier">Luxury</div>
              <div className="pricing-price">
                Rs. 1,250<span style={{ fontSize: 28, opacity: 0.5 }}>/item</span>
              </div>
              <div className="pricing-unit">Dry Clean • Couture Care</div>
              <ul className="pricing-features">
                <li>
                  <span className="material-symbols-outlined">check</span>Premium garment handling
                </li>
                <li>
                  <span className="material-symbols-outlined">check</span>Protective packaging
                </li>
                <li>
                  <span className="material-symbols-outlined">check</span>Inspected + tagged
                </li>
              </ul>
              {showBooking && (
                <Link className="btn-primary" href={loginUrlForBooking("luxury")} prefetch={false}>
                  Book Luxury
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section-pad" style={{ background: "var(--bg)" }}>
        <div className="section-inner">
          <div className="section-label animate-in">Reviews</div>
          <h2 className="section-title animate-in">
            Loved
            <br />
            By Colombo.
          </h2>

          <div className="testimonial-slider animate-in">
            <div className="testimonial-track" id="testimonialTrack" ref={trackRef}>
              {visibleReviews.map((t, idx) => (
                <div className="testimonial-card" key={idx}>
                  <div className="testimonial-stars">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <span className="material-symbols-outlined" key={i}>
                        star
                      </span>
                    ))}
                  </div>
                  <p className="testimonial-quote">{t.quote}</p>
                  <div className="testimonial-author">
                    <div className="testimonial-avatar">{t.name.slice(0, 1)}</div>
                    <div>
                      <div className="testimonial-name">{t.name}</div>
                      <div className="testimonial-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="slider-controls">
            <button className="slider-btn" type="button" onClick={() => slideTestimonials(-1)}>
              ←
            </button>
            <button className="slider-btn" type="button" onClick={() => slideTestimonials(1)}>
              →
            </button>
            <div
              id="slideCounter"
              style={{
                marginLeft: "auto",
                fontFamily: "Space Grotesk",
                fontWeight: 800,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                opacity: 0.6,
                alignSelf: "center",
              }}
            >
              {slidePos + 1} / {visibleReviews.length}
            </div>
          </div>

          <div className="config-card animate-in" style={{ marginTop: 28 }}>
            <div className="config-title">Rate Laundra</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={`${n} stars`}
                  style={{
                    border: "3px solid var(--black)",
                    background: n <= rating ? "var(--yellow)" : "white",
                    boxShadow: "3px 3px 0 0 var(--black)",
                    width: 42,
                    height: 42,
                    cursor: "pointer",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Tell us about your experience"
              style={{
                width: "100%",
                minHeight: 96,
                border: "3px solid var(--black)",
                padding: "12px 14px",
                fontFamily: "Inter",
                fontWeight: 600,
                resize: "vertical",
                marginBottom: 14,
              }}
            />
            <button className="btn-primary" type="button" onClick={() => void submitReview()}>
              Submit rating
            </button>
            {reviewStatus && (
              <div style={{ marginTop: 12, fontFamily: "Inter", fontSize: 13, fontWeight: 700 }}>
                {reviewStatus}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-pad bg-alt" id="faq">
        <div className="section-inner">
          <div className="section-label animate-in">FAQ</div>
          <h2 className="section-title animate-in">
            Answers,
            <br />
            Precise.
          </h2>

          {[
            {
              q: "How fast is pickup & delivery?",
              a: "Most Colombo pickups happen within 2 hours, based on rider availability. Standard turnaround is within 24 hours. Express 6h is available for eligible areas.",
            },
            {
              q: "How do I become a rider?",
              a: 'Tap "Become a Rider" and create a rider account. If you are already a customer, confirm rider mode from the rider portal prompt.',
            },
            {
              q: "Do you use LKR pricing only?",
              a: "Yes — all pricing is in Sri Lankan Rupees (Rs.). Your estimate updates live based on weight and extras.",
            },
            {
              q: "What about damage or missing items?",
              a: "All garments are handled with strict handoff tracking. If there’s an issue, contact support within 48 hours and we’ll resolve it fast with an insured claim process.",
            },
          ].map((item, idx) => {
            const open = openFaq === idx;
            return (
              <div className="faq-item animate-in" key={idx}>
                <button
                  className={`faq-question ${open ? "open" : ""}`}
                  type="button"
                  onClick={() => setOpenFaq((p) => (p === idx ? null : idx))}
                >
                  {item.q}
                  <span className="material-symbols-outlined faq-arrow">expand_more</span>
                </button>
                <div className={`faq-answer ${open ? "open" : ""}`}>
                  <div className="faq-answer-inner">{item.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <div className="animate-in-left">
            <div className="cta-title">
              Ready for
              <br />
              <em>Luxury</em> Clean?
            </div>
          </div>
          <div className="animate-in">
            <div className="email-bar">
              <input
                placeholder="EMAIL"
                aria-label="Email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  setNotifyMessage(
                    notifyEmail.trim() ? "Thanks. We saved your interest." : "Enter your email first.",
                  );
                }}
              >
                Notify Me
              </button>
            </div>
            {notifyMessage && (
              <div style={{ marginTop: 10, color: "rgba(255,255,255,0.82)", fontSize: 13, fontWeight: 700 }}>
                {notifyMessage}
              </div>
            )}
            <div style={{ marginTop: 16, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              Delivery fee starts at {formatLKR(1000)} depending on location.
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="main-footer">
        <div className="footer-grid">
          <div>
            <div className="footer-logo">LAUNDRA</div>
            <div className="footer-tagline">Clean. Bold. Precise.</div>
            <div className="footer-desc">
              Premium laundry pickup & delivery for Sri Lanka’s modern cities. White-glove handling,
              real-time tracking, and a rider network built for speed.
            </div>
          </div>
          <div>
            <div className="footer-col-title">Product</div>
            <ul className="footer-links">
              {showBooking && (
                <li>
                  <Link href={loginUrlForBooking("basic")} prefetch={false}>
                    Book Pickup
                  </Link>
                </li>
              )}
              {!user && (
                <li>
                  <Link href="/signup?role=rider">Rider Portal</Link>
                </li>
              )}
              {profile?.role === "rider" && (
                <li>
                  <Link href="/rider">Rider Portal</Link>
                </li>
              )}
              {profile?.role === "customer" && (
                <li>
                  <Link href="/customer">My Orders</Link>
                </li>
              )}
              {!user && (
                <>
                  <li>
                    <Link href="/login">Log in</Link>
                  </li>
                  <li>
                    <Link href="/signup">Sign up</Link>
                  </li>
                </>
              )}
              <li>
                <Link href="/#pricing">Pricing</Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Company</div>
            <ul className="footer-links">
              <li>
                <Link href="/#process">About Us</Link>
              </li>
              <li>
                <Link href="/login?switch=rider">Careers</Link>
              </li>
              <li>
                <Link href="/#features">Press Kit</Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Support</div>
            <ul className="footer-links">
              <li>
                <Link href="/#faq">Help Center</Link>
              </li>
              <li>
                <Link href="/#faq">Privacy</Link>
              </li>
              <li>
                <Link href="/#faq">Terms</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© {new Date().getFullYear()} LAUNDRA · Sri Lanka</div>
          <div className="footer-copy">Colombo · Dehiwala · Nugegoda · Rajagiriya</div>
        </div>
      </footer>
    </div>
  );
}
