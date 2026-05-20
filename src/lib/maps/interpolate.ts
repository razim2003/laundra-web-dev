import { useEffect, useRef, useState } from "react";
import type { LatLng } from "./geo";

export function useSmoothPosition(target: LatLng | null, durationMs = 1500) {
  const [current, setCurrent] = useState<LatLng | null>(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const fromRef = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!target) {
      const timer = window.setTimeout(() => setCurrent(null), 0);
      return () => window.clearTimeout(timer);
    }
    const from = current ?? target;
    fromRef.current = from;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = {
        lat: from.lat + (target.lat - from.lat) * eased,
        lng: from.lng + (target.lng - from.lng) * eased,
      };
      setCurrent(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target?.lat, target?.lng, durationMs]);

  return current;
}
