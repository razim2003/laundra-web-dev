"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Circle, Marker, Tooltip } from "react-leaflet";
import BaseMap from "./BaseMap";
import { getCityCenter, type LatLng } from "@/lib/maps/geo";
import { useSupabaseUser } from "@/lib/supabase/session";
import { useAllTracking } from "@/lib/maps/tracking";

export default function AdminOperationsMap() {
  const { supabase } = useSupabaseUser();
  const points = useAllTracking(supabase);

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

  const latestByRider = useMemo(() => {
    const map = new Map<string, LatLng>();
    points.forEach((p) => {
      if (p.rider_id) map.set(p.rider_id, { lat: p.lat, lng: p.lng });
    });
    return Array.from(map.entries()).map(([riderId, pos]) => ({ riderId, pos }));
  }, [points]);

  const heatCells = useMemo(() => {
    const grid = new Map<string, { lat: number; lng: number; count: number }>();
    points.forEach((p) => {
      const key = `${p.lat.toFixed(2)}-${p.lng.toFixed(2)}`;
      const existing = grid.get(key);
      if (existing) existing.count += 1;
      else grid.set(key, { lat: p.lat, lng: p.lng, count: 1 });
    });
    return Array.from(grid.values());
  }, [points]);

  const boundsPoints = useMemo(
    () => latestByRider.map((r) => r.pos),
    [latestByRider],
  );

  const center = boundsPoints[0] ?? getCityCenter("Colombo");

  return (
    <div className="map-shell glass" style={{ padding: 16 }}>
      <div className="map-frame map-height-md">
        <div className="map-overlay">
          <div className="map-chip blue">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              visibility
            </span>
            Ops live view
          </div>
          <div className="map-chip soft">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              groups
            </span>
            {latestByRider.length} active riders
          </div>
        </div>

        <BaseMap center={center} boundsPoints={boundsPoints}>
          {heatCells.map((cell, idx) => (
            <Circle
              key={`${cell.lat}-${cell.lng}-${idx}`}
              center={[cell.lat, cell.lng]}
              radius={cell.count * 120}
              pathOptions={{ color: "#ffcc00", fillColor: "#ffcc00", fillOpacity: 0.15 }}
            />
          ))}
          {latestByRider.map((r) => (
            <Marker key={r.riderId} position={[r.pos.lat, r.pos.lng]} icon={riderIcon}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                Rider {r.riderId.slice(0, 6)}…
              </Tooltip>
            </Marker>
          ))}
        </BaseMap>
      </div>
    </div>
  );
}
