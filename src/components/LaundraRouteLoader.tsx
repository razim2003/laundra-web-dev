type Props = {
  title?: string;
  subtitle?: string;
  /** `compact` = inset card for map shells and small panels */
  variant?: "full" | "compact";
};

/**
 * Branded route transition / auth wait UI (Space Grotesk, yellow bar, black borders).
 * Use in `loading.tsx`, Suspense fallbacks, and while Supabase session resolves.
 */
export default function LaundraRouteLoader({
  title = "Loading",
  subtitle = "One moment — calibrating the clean.",
  variant = "full",
}: Props) {
  if (variant === "compact") {
    return (
      <div className="laundra-route-loader-compact" aria-busy="true">
        <div className="laundra-route-loader-compact-title">{title}</div>
        <div className="laundra-route-loader-track laundra-route-loader-track--sm" aria-hidden>
          <div className="laundra-route-loader-fill" />
        </div>
        <div className="laundra-route-loader-dots">
          <span className="loading-dots blue" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="laundra-route-loader-wrap page-section active" aria-busy="true" aria-live="polite">
      <div className="laundra-route-loader-card">
        <div className="laundra-route-loader-brand">LAUNDRA</div>
        <div className="laundra-route-loader-title">{title}</div>
        <p className="laundra-route-loader-sub">{subtitle}</p>
        <div className="laundra-route-loader-track" aria-hidden>
          <div className="laundra-route-loader-fill" />
        </div>
        <div className="laundra-route-loader-dots" aria-hidden>
          <span className="loading-dots blue">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}
