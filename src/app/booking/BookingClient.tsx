"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import LaundraRouteLoader from "@/components/LaundraRouteLoader";
import { useSupabaseUser } from "@/lib/supabase/session";

type Service = "wash" | "iron";
type PaymentMethod = "cash_on_delivery" | "card";

function formatLKR(amount: number) {
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

export default function BookingClient() {
  const router = useRouter();
  const search = useSearchParams();
  const initialPackage = (search.get("package") ?? "basic") as "basic" | "pro" | "luxury";
  const bookingReturnPath = useMemo(() => {
    const q = search.toString();
    return q ? `/booking?${q}` : "/booking";
  }, [search]);
  const pickupScheduleRef = useRef<HTMLDivElement>(null);

  const { supabase, user, profile, loading: authLoading } = useSupabaseUser();

  const [service, setService] = useState<Service>("wash");
  const [weight, setWeight] = useState(12);
  const [addons, setAddons] = useState({
    softener: false,
    hypo: true,
    eco: false,
    scent: false,
    express: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_delivery");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [paymentStage, setPaymentStage] = useState<"idle" | "processing" | "paid">("idle");
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);

  const [address, setAddress] = useState("NO. 12, GALLE ROAD, COLOMBO 03");
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [timeWindow, setTimeWindow] = useState("09:00 – 11:00");
  const [city] = useState("Colombo");
  const invoiceNumber = useMemo(() => `LND-${scheduledDate.replaceAll("-", "")}-${weight}${initialPackage.slice(0, 2).toUpperCase()}`, [scheduledDate, weight, initialPackage]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(bookingReturnPath)}`);
      return;
    }
    if (profile?.role === "rider") {
      router.replace("/rider");
    }
  }, [authLoading, user, profile?.role, router, bookingReturnPath]);

  const authBlocked = authLoading || !user || profile?.role === "rider";

  const pricing = useMemo(() => {
    const basePerKg = initialPackage === "pro" ? 650 : service === "wash" ? 450 : 250; // LKR per kg
    const deliveryFee = 1000;

    let total = basePerKg * weight + deliveryFee;
    if (addons.softener) total += 300;
    if (addons.hypo) total += 450;
    if (addons.eco) total += 400;
    if (addons.scent) total += 300;
    if (addons.express) total += initialPackage === "pro" ? 1500 : 1800;

    const serviceName =
      initialPackage === "luxury" ? "Dry Clean" : service === "wash" ? "Wash & Fold" : "Ironing Only";
    const addonNames = Object.entries(addons)
      .filter(([, v]) => v)
      .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));

    return {
      total,
      serviceName,
      details: `${serviceName} · ${weight}kg` + (addonNames.length ? ` · ${addonNames.join(", ")}` : ""),
      deliveryFee,
      subtotal: total - deliveryFee,
      addonNames,
    };
  }, [service, weight, addons, initialPackage]);

  const toggleAddon = (name: keyof typeof addons) => {
    setAddons((a) => ({ ...a, [name]: !a[name] }));
  };

  const adjustWeight = (delta: number) => {
    const next = Math.max(1, Math.min(50, weight + delta));
    setWeight(next);
  };

  const clearPaymentResult = () => {
    setPaymentStage("idle");
    setPaymentReceipt(null);
  };

  const validateCardPayment = () => {
    const digits = cardNumber.replace(/\D/g, "");
    if (!cardName.trim() || digits.length < 12 || !cardExpiry.includes("/") || cardCvc.replace(/\D/g, "").length < 3) {
      return "Complete the simulated card payment fields before confirming.";
    }
    return null;
  };

  const bookingSchema = useMemo(
    () =>
      z.object({
        address: z.string().min(8),
        city: z.string().min(2),
        scheduledDate: z.string().min(10),
        timeWindow: z.string().min(5),
        weight: z.number().int().min(1).max(50),
      }),
    [],
  );

  const confirmBooking = async () => {
    setSaveError(null);
    if (authLoading) return;

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(bookingReturnPath)}`);
      return;
    }
    if (!supabase) {
      setSaveError("Supabase is not configured. Create `.env.local` from `.env.example`.");
      return;
    }

    const parsed = bookingSchema.safeParse({
      address,
      city,
      scheduledDate,
      timeWindow,
      weight,
    });
    if (!parsed.success) {
      setSaveError("Please complete pickup details (address, date, and time window).");
      return;
    }

    setSaving(true);
    try {
      let simulatedReceipt = paymentReceipt;
      if (paymentMethod === "card" && paymentStage !== "paid") {
        const cardError = validateCardPayment();
        if (cardError) {
          setSaveError(cardError);
          return;
        }
        setPaymentStage("processing");
        await new Promise((resolve) => window.setTimeout(resolve, 1100));
        simulatedReceipt = `SIM-${Date.now().toString().slice(-8)}`;
        setPaymentReceipt(simulatedReceipt);
        setPaymentStage("paid");
      }

      const packageId = initialPackage;
      const serviceType = packageId === "luxury" ? "dry_clean" : service === "wash" ? "wash" : "iron";
      const cardLast4 = paymentMethod === "card" ? cardNumber.replace(/\D/g, "").slice(-4) : null;

      const { data: inserted, error } = await supabase
        .from("bookings")
        .insert({
          customer_id: user.id,
          package_id: packageId,
          service_type: serviceType,
          weight_kg: packageId === "luxury" ? null : weight,
          item_count: packageId === "luxury" ? Math.max(1, Math.round(weight / 2)) : null,
          addons: {
            ...addons,
            checkout: {
              payment_method: paymentMethod,
              invoice_number: invoiceNumber,
              payment_status: paymentMethod === "card" ? "paid" : "pending",
              receipt_number: simulatedReceipt,
              card_last4: cardLast4,
            },
          },
          pickup_address: address,
          pickup_city: city,
          scheduled_date: scheduledDate,
          scheduled_window: timeWindow,
          total_lkr: pricing.total,
          delivery_fee_lkr: pricing.deliveryFee,
        })
        .select("id")
        .single();

      if (error) throw error;

      const { error: paymentError } = await supabase.from("payments").insert({
        booking_id: inserted.id,
        customer_id: user.id,
        amount_lkr: pricing.total,
        status: paymentMethod === "card" ? "paid" : "pending",
        provider: paymentMethod === "card" ? "simulated_card" : "cash_on_delivery",
        method: paymentMethod,
        invoice: {
          invoice_number: invoiceNumber,
          receipt_number: simulatedReceipt,
          service: pricing.serviceName,
          package_id: packageId,
          details: pricing.details,
          subtotal_lkr: pricing.subtotal,
          delivery_fee_lkr: pricing.deliveryFee,
          total_lkr: pricing.total,
          payment_status: paymentMethod === "card" ? "paid" : "pending",
          card_last4: cardLast4,
        },
      });

      if (paymentError) {
        console.warn("[laundra] payment row was not created:", paymentError.message);
      }

      await supabase.from("booking_events").insert({
        booking_id: inserted.id,
        status: "booking_placed",
        note: "Booking placed",
        created_by: user.id,
      });

      router.replace(`/customer?new=${inserted.id}`);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authBlocked) {
    return (
      <div id="page-booking" className="page-section active">
        <LaundraRouteLoader title="New booking" subtitle="Checking your session…" />
      </div>
    );
  }

  return (
    <div id="page-booking" className="page-section active">
      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">LAUNDRA</div>
          <Link className="sidebar-link" href="/">
            <span className="material-symbols-outlined">arrow_back</span> Back to Site
          </Link>
          <Link className="sidebar-link active" href={bookingReturnPath}>
            <span className="material-symbols-outlined">local_laundry_service</span> New Booking
          </Link>
          <Link className="sidebar-link" href="/customer#customer-orders">
            <span className="material-symbols-outlined">map</span> Track Order
          </Link>
          <Link className="sidebar-link" href="/customer#customer-history">
            <span className="material-symbols-outlined">history</span> History
          </Link>
          <Link className="sidebar-link" href="/customer#customer-settings">
            <span className="material-symbols-outlined">settings</span> Settings
          </Link>
          <Link className="sidebar-link" href="/customer#customer-settings" style={{ marginTop: "auto" }}>
            <span className="material-symbols-outlined">account_circle</span> Profile
          </Link>
        </aside>

        <main className="dash-main">
          <div className="dash-header">New Booking</div>

          <div className="booking-grid" style={{ marginBottom: 32 }}>
            <div
              className={`service-card ${service === "wash" ? "selected" : ""}`}
              id="service-wash"
              role="button"
              tabIndex={0}
              onClick={() => setService("wash")}
              onKeyDown={(e) => e.key === "Enter" && setService("wash")}
            >
              <div className="service-num">01</div>
              <span className="material-symbols-outlined service-icon">wash</span>
              <h3 className="service-title">
                Wash &<br />
                Fold
              </h3>
              <p className="service-desc">
                Full laundry cycle: wash, dry, and professional fold. Ready for the drawer.
              </p>
            </div>

            <div
              className={`service-card ${service === "iron" ? "selected" : ""}`}
              id="service-iron"
              role="button"
              tabIndex={0}
              onClick={() => setService("iron")}
              onKeyDown={(e) => e.key === "Enter" && setService("iron")}
            >
              <div className="service-num">02</div>
              <span className="material-symbols-outlined service-icon">iron</span>
              <h3 className="service-title">
                Ironing
                <br />
                Only
              </h3>
              <p className="service-desc">
                Steam-pressed perfection for shirts, trousers, and delicate fabrics.
              </p>
            </div>
          </div>

          <div className="booking-config-grid" style={{ marginBottom: 32 }}>
            <div className="config-card">
              <div className="config-title">Estimated Weight</div>
              <div className="weight-display">
                <div className="weight-num" id="weightDisplay">
                  {weight}
                </div>
                <div className="weight-unit">KG</div>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={weight}
                id="weightSlider"
                onChange={(e) => setWeight(parseInt(e.target.value, 10))}
                style={{ marginBottom: 20 }}
                aria-label="Estimated weight"
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "Space Grotesk",
                  fontWeight: 800,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 20,
                  opacity: 0.5,
                }}
              >
                <span>1 KG</span>
                <span>25 KG</span>
                <span>50 KG</span>
              </div>
              <div className="weight-btns">
                <button className="weight-btn" type="button" onClick={() => adjustWeight(1)}>
                  +1 KG
                </button>
                <button className="weight-btn" type="button" onClick={() => adjustWeight(5)}>
                  +5 KG
                </button>
                <button className="weight-btn minus" type="button" onClick={() => adjustWeight(-1)}>
                  −1 KG
                </button>
                <button className="weight-btn minus" type="button" onClick={() => adjustWeight(-5)}>
                  −5 KG
                </button>
              </div>
            </div>

            <div className="config-card" style={{ background: "var(--black)", color: "white", borderColor: "var(--black)" }}>
              <div className="config-title" style={{ color: "var(--primary-container)", borderBottomColor: "#333" }}>
                Quick Extras
              </div>
              <div className="addon-list">
                <div className="addon-item" onClick={() => toggleAddon("softener")}>
                  <div className="addon-label" style={{ color: "white" }}>
                    Fabric Softener
                  </div>
                  <div className={`addon-check ${addons.softener ? "checked" : ""}`} id="addon-softener" />
                </div>
                <div className="addon-item" onClick={() => toggleAddon("hypo")}>
                  <div className="addon-label" style={{ color: "white" }}>
                    Hypoallergenic
                  </div>
                  <div className={`addon-check ${addons.hypo ? "checked" : ""}`} id="addon-hypo" />
                </div>
                <div className="addon-item" onClick={() => toggleAddon("eco")}>
                  <div className="addon-label" style={{ color: "white" }}>
                    Eco-Friendly
                  </div>
                  <div className={`addon-check ${addons.eco ? "checked" : ""}`} id="addon-eco" />
                </div>
                <div className="addon-item" onClick={() => toggleAddon("scent")}>
                  <div className="addon-label" style={{ color: "white" }}>
                    Scent Boosters
                  </div>
                  <div className={`addon-check ${addons.scent ? "checked" : ""}`} id="addon-scent" />
                </div>
                <div className="addon-item" onClick={() => toggleAddon("express")}>
                  <div className="addon-label" style={{ color: "white" }}>
                    Express 6h +{formatLKR(1500)}
                  </div>
                  <div className={`addon-check ${addons.express ? "checked" : ""}`} id="addon-express" />
                </div>
              </div>
              <div style={{ marginTop: 20, borderTop: "2px solid #333", paddingTop: 16 }}>
                <div
                  className="order-total-label"
                  style={{
                    color: "#888",
                    fontFamily: "Space Grotesk",
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Estimate (incl. delivery {formatLKR(pricing.deliveryFee)})
                </div>
                <div className="order-total" id="priceDisplay">
                  {formatLKR(pricing.total)}
                </div>
              </div>
            </div>
          </div>

          <div className="config-card" ref={pickupScheduleRef} id="pickup-schedule-section">
            <div className="config-title">Pickup Details</div>
            <div className="booking-pickup-grid">
              <div>
                <label
                  style={{
                    fontFamily: "Space Grotesk",
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: 8,
                    display: "block",
                    opacity: 0.6,
                  }}
                >
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="NO. 12, GALLE ROAD, COLOMBO 03"
                  style={{
                    width: "100%",
                    border: "3px solid var(--black)",
                    padding: "12px 14px",
                    fontFamily: "Space Grotesk",
                    fontWeight: 700,
                    fontSize: 13,
                    textTransform: "uppercase",
                    outline: "none",
                    background: "white",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontFamily: "Space Grotesk",
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: 8,
                    display: "block",
                    opacity: 0.6,
                  }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  style={{
                    width: "100%",
                    border: "3px solid var(--black)",
                    padding: "12px 14px",
                    fontFamily: "Space Grotesk",
                    fontWeight: 700,
                    fontSize: 13,
                    outline: "none",
                    background: "white",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontFamily: "Space Grotesk",
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: 8,
                    display: "block",
                    opacity: 0.6,
                  }}
                >
                  Time Window
                </label>
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  style={{
                    width: "100%",
                    border: "3px solid var(--black)",
                    padding: "12px 14px",
                    fontFamily: "Space Grotesk",
                    fontWeight: 700,
                    fontSize: 13,
                    textTransform: "uppercase",
                    outline: "none",
                    background: "white",
                  }}
                >
                  <option>09:00 – 11:00</option>
                  <option>11:00 – 13:00</option>
                  <option>13:00 – 15:00</option>
                  <option>15:00 – 17:00</option>
                  <option>17:00 – 19:00</option>
                </select>
              </div>
            </div>
          </div>

          <div className="config-card" style={{ marginBottom: 32 }}>
            <div className="config-title">Payment</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {([
                ["cash_on_delivery", "Cash on delivery", "Pay the rider after pickup confirmation."],
                ["card", "Card payment", "Pay by card terminal or secure payment link."],
              ] as const).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(value);
                    clearPaymentResult();
                  }}
                  style={{
                    border: "3px solid var(--black)",
                    background: paymentMethod === value ? "var(--yellow)" : "white",
                    boxShadow: "4px 4px 0 0 var(--black)",
                    padding: "14px 16px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontFamily: "Space Grotesk", fontWeight: 900, textTransform: "uppercase", fontSize: 12 }}>
                    {title}
                  </div>
                  <div style={{ marginTop: 6, fontFamily: "Inter", fontSize: 13, lineHeight: 1.45, opacity: 0.78 }}>
                    {desc}
                  </div>
                </button>
              ))}
            </div>
            {paymentMethod === "card" && (
              <div className={`sim-payment-panel ${paymentStage === "paid" ? "paid" : ""}`}>
                <div className="sim-payment-rail">
                  <span className="material-symbols-outlined">encrypted</span>
                  <div>
                    <strong>Simulated online payment</strong>
                    <p>No real card is charged. This creates a paid invoice and receipt for testing.</p>
                  </div>
                </div>
                <div className="profile-settings-grid" style={{ marginTop: 16 }}>
                  <input
                    value={cardName}
                    onChange={(e) => {
                      setCardName(e.target.value);
                      clearPaymentResult();
                    }}
                    placeholder="Name on card"
                    autoComplete="cc-name"
                    style={{
                      width: "100%",
                      border: "3px solid var(--black)",
                      padding: "12px 14px",
                      fontFamily: "Inter",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  />
                  <input
                    value={cardNumber}
                    onChange={(e) => {
                      setCardNumber(e.target.value);
                      clearPaymentResult();
                    }}
                    placeholder="4242 4242 4242 4242"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    style={{
                      width: "100%",
                      border: "3px solid var(--black)",
                      padding: "12px 14px",
                      fontFamily: "Inter",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  />
                  <input
                    value={cardExpiry}
                    onChange={(e) => {
                      setCardExpiry(e.target.value);
                      clearPaymentResult();
                    }}
                    placeholder="MM/YY"
                    autoComplete="cc-exp"
                    style={{
                      width: "100%",
                      border: "3px solid var(--black)",
                      padding: "12px 14px",
                      fontFamily: "Inter",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  />
                  <input
                    value={cardCvc}
                    onChange={(e) => {
                      setCardCvc(e.target.value);
                      clearPaymentResult();
                    }}
                    placeholder="CVC"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    style={{
                      width: "100%",
                      border: "3px solid var(--black)",
                      padding: "12px 14px",
                      fontFamily: "Inter",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div className="sim-payment-status">
                  {paymentStage === "processing" && (
                    <>
                      <span className="loading-dots"><span /><span /><span /></span>
                      Processing simulated payment
                    </>
                  )}
                  {paymentStage === "paid" && (
                    <>
                      <span className="material-symbols-outlined">verified</span>
                      Paid · {paymentReceipt}
                    </>
                  )}
                  {paymentStage === "idle" && (
                    <>
                      <span className="material-symbols-outlined">credit_card</span>
                      Payment runs when booking is confirmed
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="config-card" style={{ marginBottom: 32, background: "#fffef5" }}>
            <div className="config-title">Mini invoice</div>
            <div style={{ display: "grid", gap: 10, fontFamily: "Inter", fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>Invoice</strong>
                <span>{invoiceNumber}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>{pricing.serviceName}</span>
                <strong>{formatLKR(pricing.subtotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Delivery</span>
                <strong>{formatLKR(pricing.deliveryFee)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Payment</span>
                <strong>{paymentMethod === "card" ? "Card payment" : "Cash on delivery"}</strong>
              </div>
              {paymentMethod === "card" && paymentReceipt && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Receipt</span>
                  <strong>{paymentReceipt}</strong>
                </div>
              )}
              <div
                style={{
                  borderTop: "3px solid var(--black)",
                  paddingTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontFamily: "Space Grotesk",
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                <span>Total</span>
                <span>{formatLKR(pricing.total)}</span>
              </div>
            </div>
          </div>

          <div className="order-summary">
            <div>
              <div className="order-total-label">Total Estimate</div>
              <div className="order-total" id="summaryPrice">
                {formatLKR(pricing.total)}
              </div>
              <div className="order-details" id="summaryDetails">
                {pricing.details}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className="btn-outline"
                type="button"
                style={{ color: "white", borderColor: "white", boxShadow: "4px 4px 0 0 white" }}
                onClick={() =>
                  pickupScheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <span
                  className="material-symbols-outlined"
                  style={{ verticalAlign: "middle", marginRight: 6, fontSize: "18px" }}
                >
                  schedule
                </span>
                Set Pickup Time
              </button>
              <button
                className="btn-yellow"
                type="button"
                style={{ fontSize: 14, opacity: saving ? 0.7 : 1 }}
                onClick={confirmBooking}
                disabled={saving}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ verticalAlign: "middle", marginRight: 6, fontSize: "18px" }}
                >
                  check_circle
                </span>
                {saving ? (paymentMethod === "card" ? "Processing..." : "Confirming...") : "Confirm Booking"}
              </button>
            </div>
          </div>

          {saveError && (
            <div
              style={{
                marginTop: 18,
                border: "3px solid var(--black)",
                background: "#fff",
                boxShadow: "4px 4px 0 0 var(--black)",
                padding: "14px 16px",
                maxWidth: 840,
                color: "var(--red)",
                fontWeight: 800,
                fontFamily: "Space Grotesk",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {saveError}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
