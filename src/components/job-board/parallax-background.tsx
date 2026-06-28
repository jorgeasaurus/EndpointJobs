"use client";

import { useEffect, useRef } from "react";

import { mountEndpointSignalField } from "./signal-field";

export function ParallaxBackground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const field = fieldRef.current;

    if (!host || !field || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    return mountEndpointSignalField(host, field);
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
