"use client";

import { useEffect, useRef, useState } from "react";

import { siteUrl } from "@/app/site-metadata";

// The row stays hidden until the widget reports a count, so a blocked or failed
// widget never leaves a dead control. A zero count shows the button without the "0".
function readTotal(detail: unknown) {
  if (typeof detail !== "object" || detail === null) return null;
  const total = (detail as { totalCount?: unknown }).totalCount;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

export function AppreciateButton() {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onCounts = (event: Event) => {
      const reported = readTotal((event as CustomEvent).detail);
      if (reported !== null) setTotal(reported);
    };
    const onError = () => setTotal(null);

    container.addEventListener("appreciate:ready", onCounts);
    container.addEventListener("appreciate:change", onCounts);
    container.addEventListener("appreciate:error", onError);

    // The widget mutates its own attributes; mount after React hydrates its host.
    const button = document.createElement("appreciate-button");
    button.dataset.key = "pk_8645244f778c5c051940ebd5447377ac";
    button.dataset.api = "https://appreciate-button.com";
    button.dataset.item = siteUrl;
    button.dataset.label = "Appreciate this board";
    button.dataset.count = "right";
    container.append(button);

    return () => {
      container.removeEventListener("appreciate:ready", onCounts);
      container.removeEventListener("appreciate:change", onCounts);
      container.removeEventListener("appreciate:error", onError);
      button.remove();
    };
  }, []);

  return (
    <div className="footer-appreciation" data-has-count={total !== null && total > 0} hidden={total === null}>
      <span>Appreciate this board</span>
      <span className="appreciate-button-host" ref={containerRef} />
    </div>
  );
}
