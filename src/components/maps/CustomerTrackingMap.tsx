"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, Marker, Polyline, Tooltip } from "react-leaflet";
import BaseMap from "./BaseMap";
import {
  fetchRoute,
  formatDistance,
  formatEta,
  geocodeAddress,
  getCityCenter,
  type LatLng,
} from "@/lib/maps/geo";
import { useSupabaseUser } from "@/lib/supabase/session";
import { useBookingTracking } from "@/lib/maps/tracking";
import { useSmoothPosition } from "@/lib/maps/interpolate";

type BookingDetails = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  status: string;
  rider_id: string | null;
};

type Props = {
  bookingId: string;
};

const statusLabels: Record<string, { label: string; progress: number }> = {
  booking_placed: { label: "Booking placed", progress: 0.1 },
  rider_assigned: { label: "Rider assigned", progress: 0.25 },
  rider_arriving: { label: "Rider en route", progress: 0.4 },
  picked_up: { label: "Picked up", progress: 0.6 },
  washing_started: { label: "Washing", progress: 0.7 },
  ironing: { label: "Ironing", progress: 0.8 },
  out_for_delivery: { label: "Out for delivery", progress: 0.9 },
  delivered: { label: "Delivered", progress: 1 },
  canceled: { label: "Canceled", progress: 0 },
};

function getStatusMeta(status?: string | null) {
  if (!status) return { label: "Tracking live", progress: 0.3 };
  return statusLabels[status] ?? { label: status.replaceAll("_", " "), progress: 0.3 };
}

export default function CustomerTrackingMap({ bookingId }: Props) {
  const { supabase } = useSupabaseUser();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [hub, setHub] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const lastRouteAt = useRef(0);

  const { latest } = useBookingTracking(supabase, bookingId);
  const smoothRider = useSmoothPosition(latest ? { lat: latest.lat, lng: latest.lng } : null, 1800);

  const riderIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<div class="rider-marker"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    [],
  );

  const pickupIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<div class="pickup-marker">P</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    [],
  );

  const dropoffIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<div class="dropoff-marker">H</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    [],
  );

  useEffect(() => {
    if (!supabase || !bookingId) return;
    let mounted = true;

    supabase
      .from("bookings")
      .select("id,pickup_address,pickup_city,status,rider_id")
      .eq("id", bookingId)
      .single()
      .then(({ data }) => {
        if (!mounted) return;
        setBooking((data ?? null) as BookingDetails | null);
      });

    return () => {
      mounted = false;
    };
  }, [supabase, bookingId]);

  useEffect(() => {
    if (!booking) return;
    let active = true;

    geocodeAddress(booking.pickup_address, booking.pickup_city)
      .then((coords) => {
        if (!active) return;
        setPickup(coords);
        const hubCenter = getCityCenter(booking.pickup_city);
        setHub({ lat: hubCenter.lat + 0.01, lng: hubCenter.lng + 0.01 });
      })
      .catch(() => {
        if (!active) return;
        const fallback = getCityCenter(booking.pickup_city);
        setPickup(fallback);
        setHub({ lat: fallback.lat + 0.01, lng: fallback.lng + 0.01 });
      });

    return () => {
      active = false;
    };
  }, [booking]);

  const statusMeta = useMemo(() => getStatusMeta(booking?.status), [booking?.status]);
  const isWaiting = booking?.status === "booking_placed";
  const boundsPoints = useMemo(() => {
    const points: LatLng[] = [];
    if (pickup) points.push(pickup);
    if (hub) points.push(hub);
    if (smoothRider) points.push(smoothRider);
    return points;
  }, [pickup, hub, smoothRider]);

  useEffect(() => {
    if (!pickup || !hub) return;
    const riderPoint = latest ? { lat: latest.lat, lng: latest.lng } : pickup;
    const now = Date.now();
    if (now - lastRouteAt.current < 8000) return;
    lastRouteAt.current = now;

    let active = true;
    setRouteLoading(true);
    fetchRoute([riderPoint, pickup, hub]).then((result) => {
      if (!active) return;
      if (!result) {
        setRoute([]);
        setRouteInfo(null);
      } else {
        setRoute(result.coords);
        setRouteInfo({ distance: result.distanceMeters, duration: result.durationSeconds });
      }
      setRouteLoading(false);
    });

    return () => {
      active = false;
    };
  }, [pickup?.lat, pickup?.lng, hub?.lat, hub?.lng, latest?.lat, latest?.lng]);

  const center = pickup ?? getCityCenter(booking?.pickup_city ?? "Colombo");

  return (
    <div className="map-shell glass" style={{ padding: 16 }}>
      <div className="map-frame map-height-lg">
        <div className="map-overlay">
          <div className="map-chip blue">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              radio_button_checked
            </span>
            Live rider tracking
          </div>
          <div className="map-chip soft">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              schedule
            </span>
            {routeInfo ? `ETA ${formatEta(routeInfo.duration)}` : "Calculating ETA"}
          </div>
          <div className="map-chip dark">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              distance
            </span>
            {routeInfo ? formatDistance(routeInfo.distance) : "Route loading"}
          </div>
        </div>

        {isWaiting && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              padding: "10px 12px",
              border: "2px solid var(--black)",
              background: "#fff3c4",
              fontFamily: "Space Grotesk",
              fontWeight: 800,
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: "0.08em",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "4px 4px 0 0 var(--black)",
            }}
          >
            Finding rider
            <span className="loading-dots yellow" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}

        <BaseMap center={center} boundsPoints={boundsPoints}>
          {route.length > 0 && (
            <Polyline
              positions={route.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: "#005ab4", weight: 5, opacity: 0.85 }}
              className="route-animate"
            />
          )}
          {pickup && (
            <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                Pickup
              </Tooltip>
            </Marker>
          )}
          {hub && (
            <Marker position={[hub.lat, hub.lng]} icon={dropoffIcon}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                Laundra Hub
              </Tooltip>
            </Marker>
          )}
          {smoothRider ? (
            <Marker position={[smoothRider.lat, smoothRider.lng]} icon={riderIcon}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                Rider live
              </Tooltip>
            </Marker>
          ) : null}
          {smoothRider && (
            <CircleMarker
              center={[smoothRider.lat, smoothRider.lng]}
              radius={24}
              pathOptions={{ color: "#0a73e0", opacity: 0.25 }}
            />
          )}
        </BaseMap>

        {routeLoading && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              background: "rgba(26,26,26,0.85)",
              color: "white",
              padding: "8px 12px",
              border: "2px solid var(--black)",
              fontFamily: "Space Grotesk",
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Loading route
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div
          style={{
            border: "3px solid var(--black)",
            boxShadow: "4px 4px 0 0 var(--black)",
            background: "white",
            padding: 16,
          }}
        >
          <div style={{ fontFamily: "Space Grotesk", fontWeight: 900, textTransform: "uppercase" }}>
            {statusMeta.label}
          </div>
          <div
            style={{
              marginTop: 10,
              height: 10,
              border: "2px solid var(--black)",
              background: "#d6e3ff",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(statusMeta.progress * 100)}%`,
                height: "100%",
                background: "var(--primary)",
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            {booking?.pickup_address} · {booking?.pickup_city}
          </div>
        </div>
      </div>
    </div>
  );
}
