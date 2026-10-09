/**
 * Content-shaped loading placeholders. Static under prefers-reduced-motion
 * (the global rule in base.css stops the shimmer).
 */
export function Skeleton({ className = "skeleton--line", width }: { className?: string; width?: string }) {
  return <span className={`skeleton ${className}`} style={width ? { width } : undefined} aria-hidden="true" />;
}

/** Placeholder shaped like a request card in the feed. */
export function RequestCardSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="row">
        <Skeleton className="skeleton--pill" />
        <Skeleton className="skeleton--pill" width="72px" />
      </div>
      <Skeleton className="skeleton--title" />
      <Skeleton width="100%" />
      <Skeleton width="70%" />
      <div className="row">
        <Skeleton className="skeleton--avatar" />
        <Skeleton width="120px" />
      </div>
    </div>
  );
}

/** A labelled stack of card skeletons for list pages. */
export function ListSkeleton({ count = 3, label = "Loading" }: { count?: number; label?: string }) {
  return (
    <div className="stack" role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: count }, (_, i) => (
        <RequestCardSkeleton key={i} />
      ))}
    </div>
  );
}
