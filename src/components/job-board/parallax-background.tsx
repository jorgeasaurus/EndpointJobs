"use client";

import { useEffect, useRef } from "react";

export function ParallaxBackground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const field = fieldRef.current;
    let cleanup: (() => void) | undefined;
    let isDisposed = false;

    if (!host || !field || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    void import("./signal-field").then(({ mountEndpointSignalField }) => {
      if (isDisposed) {
        return;
      }

      cleanup = mountEndpointSignalField(host, field);
    });

    return () => {
      isDisposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={fieldRef}
      className="parallax-field"
      aria-hidden="true"
    >
      <span className="parallax-atmosphere" />
      <div ref={hostRef} className="parallax-three-host" />
    </div>
  );
}
