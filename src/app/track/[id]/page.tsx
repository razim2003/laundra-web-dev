"use client";

import { Suspense, use } from "react";
import dynamic from "next/dynamic";
import LaundraRouteLoader from "@/components/LaundraRouteLoader";

const CustomerTrackingMap = dynamic(() => import("@/components/maps/CustomerTrackingMap"), {
  ssr: false,
  loading: () => <LaundraRouteLoader title="Map" subtitle="Loading live tracking…" variant="compact" />,
});
type Props = {
  params: Promise<{ id: string }>;
};

export default function TrackPage({ params }: Props) {
  const { id } = use(params);

  return (
    <div className="section-pad" style={{ paddingTop: 120, background: "var(--bg)" }}>
      <div className="section-inner">
        <div className="section-label">Live Tracking</div>
        <h2 className="section-title">Your Delivery</h2>
        <Suspense>
          <CustomerTrackingMap bookingId={id} />
        </Suspense>
      </div>
    </div>
  );
}
