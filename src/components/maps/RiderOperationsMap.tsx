"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, Marker, Polyline, Tooltip } from "react-leaflet";
import BaseMap from "./BaseMap";
import { fetchRoute, formatDistance, formatEta, geocodeAddress, getCityCenter, type LatLng } from "@/lib/maps/geo";
import { useSupabaseUser } from "@/lib/supabase/session";
import { useSmoothPosition } from "@/lib/maps/interpolate";

type NearbyOrder = {
  label: string;
  pickup: string;
  city: string;
};

type BookingRow = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  status: string;
};

type Props = {
  nearbyOrders: NearbyOrder[];
};

export default function RiderOperationsMap({ nearbyOrders }: Props) {
  const { supabase, user } = useSupabaseUser();
  const [activeBooking, setActiveBooking] = useState<BookingRow | null>(null);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [hub, setHub] = useState<LatLng | null>(null);
  const [nearbyMarkers, setNearbyMarkers] = useState<Array<LatLng & { label: string }>>([]);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [riderTarget, setRiderTarget] = useState<LatLng | null>(null);
  const lastRouteAt = useRef(0);

  const smoothRider = useSmoothPosition(riderTarget, 1200);

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

  useEffect(() => {
    if (!supabase || !user) return;
    let mounted = true;

    supabase
      .from("bookings")
      .select("id,pickup_address,pickup_city,status")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!mounted) return;
        setActiveBooking((data?.[0] ?? null) as BookingRow | null);
      });

    return () => {
      mounted = false;
    };
  }, [supabase, user]);

  useEffect(() => {
    const loadNearby = async () => {
      const results: Array<LatLng & { label: string }> = [];
      for (const order of nearbyOrders) {
        try {
          const coords = await geocodeAddress(order.pickup, order.city);
          results.push({ ...coords, label: order.label });
        } catch {
          const fallback = getCityCenter(order.city);
          results.push({ ...fallback, label: order.label });
        }
      }
      setNearbyMarkers(results);
    };
    loadNearby();
  }, [nearbyOrders]);

  useEffect(() => {
    if (!activeBooking) return;
    let active = true;

    geocodeAddress(activeBooking.pickup_address, activeBooking.pickup_city)
      .then((coords) => {
        if (!active) return;
        setPickup(coords);
        const hubCenter = getCityCenter(activeBooking.pickup_city);
        setHub({ lat: hubCenter.lat + 0.01, lng: hubCenter.lng + 0.01 });
      })
      .catch(() => {
        if (!active) return;
        const fallback = getCityCenter(activeBooking.pickup_city);
        setPickup(fallback);
        setHub({ lat: fallback.lat + 0.01, lng: fallback.lng + 0.01 });
      });

    return () => {
      active = false;
    };
  }, [activeBooking]);

  useEffect(() => {
    if (!pickup || !hub) return;
    const riderPoint = riderTarget ?? pickup;
    const now = Date.now();
    if (now - lastRouteAt.current < 8000) return;
    lastRouteAt.current = now;

    let active = true;
    setRouteLoading(true);
    fetchRoute([riderPoint, pickup, hub]).then((result) => {
      if (!active) return;
      if (result) {
        setRoute(result.coords);
        setRouteInfo({ distance: result.distanceMeters, duration: result.durationSeconds });
      } else {
        setRoute([]);
        setRouteInfo(null);
      }
      setRouteLoading(false);
    });

    return () => {
      active = false;
    };
  }, [pickup?.lat, pickup?.lng, hub?.lat, hub?.lng, riderTarget?.lat, riderTarget?.lng]);

  useEffect(() => {
    if (!isLive || !supabase || !user || !activeBooking) return;
    let watchId: number | null = null;
    let intervalId: number | null = null;

    const pushUpdate = (coords: LatLng, speed?: number | null) => {
      supabase
        .from("booking_tracking")
        .insert({
          booking_id: activeBooking.id,
          rider_id: user.id,
          lat: coords.lat,
          lng: coords.lng,
          speed_mps: speed ?? null,
        })
        .then(() => undefined);
    };

    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setRiderTarget(coords);
          pushUpdate(coords, pos.coords.speed);
        },
        () => {
          setIsLive(false);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 },
      );
    } else if (route.length) {
      let idx = 0;
      intervalId = window.setInterval(() => {
        const next = route[idx];
        if (next) {
          setRiderTarget(next);
          pushUpdate(next, null);
          idx = Math.min(idx + 1, route.length - 1);
        }
      }, 2500);
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [isLive, supabase, user, activeBooking, route]);

  const center = pickup ?? getCityCenter(activeBooking?.pickup_city ?? "Colombo");
  const boundsPoints = useMemo(() => {
    const points: LatLng[] = [];
    if (pickup) points.push(pickup);
    if (hub) points.push(hub);
    if (smoothRider) points.push(smoothRider);
    nearbyMarkers.forEach((m) => points.push(m));
    return points;
  }, [pickup, hub, smoothRider, nearbyMarkers]);

  return (
    <div className="map-shell glass" style={{ padding: 16 }}>
      <div className="map-frame map-height-md">
        <div className="map-overlay">
          <div className="map-chip blue">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              navigation
            </span>
            Rider navigation
          </div>
          <div className="map-chip soft">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              route
            </span>
            {routeInfo ? `${formatDistance(routeInfo.distance)} · ${formatEta(routeInfo.duration)}` : "Route loading"}
          </div>
        </div>

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
            <CircleMarker
              center={[hub.lat, hub.lng]}
              radius={10}
              pathOptions={{ color: "#1a1a1a", fillColor: "#1a1a1a", fillOpacity: 0.9 }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                Laundra Hub
              </Tooltip>
            </CircleMarker>
          )}
          {smoothRider && (
            <Marker position={[smoothRider.lat, smoothRider.lng]} icon={riderIcon}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                You
              </Tooltip>
            </Marker>
          )}
          {nearbyMarkers.map((m, idx) => (
            <CircleMarker
              key={`${m.label}-${idx}`}
              center={[m.lat, m.lng]}
              radius={8}
              pathOptions={{ color: "#ffcc00", fillColor: "#ffcc00", fillOpacity: 0.7 }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                {m.label}
              </Tooltip>
            </CircleMarker>
          ))}
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

      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn-outline" type="button" onClick={() => setIsLive((v) => !v)}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: "middle", marginRight: 6 }}>
            {isLive ? "pause_circle" : "play_circle"}
          </span>
          {isLive ? "Pause Live" : "Go Live"}
        </button>
        <div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
          {activeBooking ? `Active booking: ${activeBooking.id.slice(0, 8)}…` : "No active booking assigned"}
        </div>
      </div>
    </div>
  );
}
