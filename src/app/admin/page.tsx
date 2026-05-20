"use client";

import dynamic from "next/dynamic";

const AdminOperationsMap = dynamic(() => import("@/components/maps/AdminOperationsMap"), {
  ssr: false,
  loading: () => (
    <div className="map-shell" style={{ padding: 24 }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 800, textTransform: "uppercase" }}>
        Loading operations map…
      </div>
    </div>
  ),
});

export default function AdminPage() {
  return (
    <div className="section-pad" style={{ paddingTop: 120, background: "var(--bg)" }}>
      <div className="section-inner">
        <div className="section-label">Admin</div>
        <h2 className="section-title">Operations</h2>
        <div style={{ display: "grid", gap: 20 }}>
          <AdminOperationsMap />
          <div className="config-card">
            <div className="config-title">Live Signals</div>
            <div style={{ display: "grid", gap: 12, fontSize: 14, opacity: 0.8 }}>
              <div>Rider locations update every few seconds via Supabase Realtime.</div>
              <div>Heatmap highlights booking activity across Sri Lanka cities.</div>
              <div>Use filters (coming next) to view active, delayed, or completed jobs.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
