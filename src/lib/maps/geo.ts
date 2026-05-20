export type LatLng = { lat: number; lng: number };

type RouteResult = {
  coords: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

const cityCenters: Record<string, LatLng> = {
  colombo: { lat: 6.9271, lng: 79.8612 },
  kandy: { lat: 7.2906, lng: 80.6337 },
  galle: { lat: 6.0535, lng: 80.2210 },
  jaffna: { lat: 9.6615, lng: 80.0255 },
  negombo: { lat: 7.2083, lng: 79.8358 },
};

export function getCityCenter(city?: string | null): LatLng {
  if (!city) return cityCenters.colombo;
  const key = city.trim().toLowerCase();
  return cityCenters[key] ?? cityCenters.colombo;
}

export async function geocodeAddress(address: string, city?: string | null): Promise<LatLng> {
  const base = process.env.NEXT_PUBLIC_NOMINATIM_API ?? "https://nominatim.openstreetmap.org";
  const query = `${address}, ${city ?? "Sri Lanka"}`;
  const url = `${base}/search?format=json&limit=1&q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      "Accept-Language": "en",
    },
  });
  if (!res.ok) throw new Error("Geocoding failed");
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return getCityCenter(city);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function fetchRoute(points: LatLng[]): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  const base = process.env.NEXT_PUBLIC_OSRM_API ?? "https://router.project-osrm.org";
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    routes?: Array<{ distance: number; duration: number; geometry: { coordinates: [number, number][] } }>;
  };
  const route = data.routes?.[0];
  if (!route) return null;

  return {
    coords: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatEta(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}
