const loadingPixels = ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"];

// Adapted from Beautiful UI's Loading State primitive.
// https://www.beautifului.dev/#loading-state
export function LoadingState({
  label,
  variant = "grid"
}: {
  label: string;
  variant?: "grid" | "orbit";
}) {
  return (
    <span
      className={`beautiful-loading-state beautiful-loading-state--${variant}`}
      role="status"
      aria-live="polite"
    >
      <span className="beautiful-loading-pixels" aria-hidden="true">
        {loadingPixels.map((pixel) => (
          <span key={pixel} />
        ))}
      </span>
      <span className="beautiful-loading-label">{label}</span>
    </span>
  );
}
