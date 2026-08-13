"use client";

import { useEffect, useState } from "react";

const loadingPixels = ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"];

// Adapted from Beautiful UI's Loading State primitive.
// https://www.beautifului.dev/#loading-state
export function LoadingState({ label }: { label: string }) {
  const [deciseconds, setDeciseconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setDeciseconds((current) => current + 1),
      100
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="beautiful-loading-state" role="status" aria-live="polite">
      <span className="beautiful-loading-pixels" aria-hidden="true">
        {loadingPixels.map((pixel) => (
          <span key={pixel} />
        ))}
      </span>
      <span className="beautiful-loading-label">{label}</span>
      <span className="beautiful-loading-elapsed" aria-hidden="true">
        {(deciseconds / 10).toFixed(1)}s
      </span>
    </span>
  );
}
