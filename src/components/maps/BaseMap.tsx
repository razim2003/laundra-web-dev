"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { LatLng } from "@/lib/maps/geo";

type FitBoundsProps = {
  points: LatLng[];
};

function FitBounds({ points }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = points.map((p) => [p.lat, p.lng]) as [number, number][];
    map.fitBounds(bounds, { padding: [40, 40], animate: true, duration: 0.9 });
  }, [map, points]);

  return null;
}

type BaseMapProps = {
  center: LatLng;
  zoom?: number;
  boundsPoints?: LatLng[];
  children?: React.ReactNode;
};

export default function BaseMap({ center, zoom = 13, boundsPoints, children }: BaseMapProps) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom style={{ height: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {boundsPoints ? <FitBounds points={boundsPoints} /> : null}
      {children}
    </MapContainer>
  );
}
