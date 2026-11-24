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

    void import("./dither-field").then(({ mountDitherField }) => {
      if (isDisposed) {
        return;
      }

      cleanup = mountDitherField(host, field);
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
      <div ref={hostRef} className="parallax-dither-host" />
    </div>
  );
}
